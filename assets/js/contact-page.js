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

  /* 常驻标签：名称 + 地址，始终显示在标记上方（不用点击） */
  function labelHtml(loc) {
    return '<div style="white-space:normal;width:max-content;max-width:230px;padding:8px 11px;' +
      'background:#FFFFFF;border:1px solid #E7EAF0;border-radius:10px;' +
      'box-shadow:0 10px 28px rgba(20,22,27,.14);text-align:left">' +
      '<strong style="display:block;font-size:13px;color:#14161B;line-height:1.4;margin-bottom:2px">' +
      escapeHtml(loc.name || '') + '</strong>' +
      '<span style="display:block;font-size:12px;color:#667084;line-height:1.6">' +
      escapeHtml(loc.address || '') + '</span></div>';
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

  /*
   * 每个标记的「实际占地」= 圆点 + 常驻标签（标签悬在圆点上方，宽 ~230、
   * 高按实测；用 offsetWidth/offsetHeight 量——它们不受地图平移缩放的
   * transform 影响，而 getBoundingClientRect 会，混用就会量到旧位置）。
   * 画布是 overflow:hidden 的，占地不把标签算进去，标签就会被顶边裁一半
   * （真实发生过：惠州标签只露出下半截）。
   */
  function footprintOf(map, entries, el) {
    var labels = el.querySelectorAll('.amap-marker-label');
    var pts = entries.map(function (e) { return map.lngLatToContainer(e.marker.getPosition()); });
    var xs = pts.map(function (p) { return p.x; });
    var ys = pts.map(function (p) { return p.y; });
    var extTop = 0;
    var extSide = 0;
    entries.forEach(function (e, i) {
      var lab = labels[i]; /* 标签与标记同序创建 */
      if (!lab) return;
      extTop = Math.max(extTop, 14 + lab.offsetHeight);
      extSide = Math.max(extSide, lab.offsetWidth / 2);
    });
    var minX = Math.min.apply(null, xs);
    var maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys);
    var maxY = Math.max.apply(null, ys);
    return {
      minX: minX - extSide, maxX: maxX + extSide,
      minY: minY - extTop, maxY: maxY + 11,
      distX: maxX - minX, distY: maxY - minY,
    };
  }

  /*
   * 把两块基地的「完整占地」（圆点 + 常驻标签）都放进「可视区」（画布减去
   * 卡片浮层）并居中。setFitView 只按整个画布算，所以跨城（深惠）时会
   * 有一个点被浮层压住、标签被顶边裁掉。
   *
   * 实现要点：标记间距每降一级缩放减半，而标签占地是固定像素——所以
   * 需要降几级可以直接算出来（一步 setZoom），不要循环试错：循环里
   * 「算出来的点位置」与「标签 DOM 的真实位置」更新节奏不一致，会把
   * 地图缩到全国视野（真实事故）。居中仍用反算中心点的 setCenter，
   * 不依赖 panBy 的方向语义；重复调用幂等（残差 ≤2px 不动）。
   */
  function adjustView(map, entries, el) {
    if (entries.length < 2) return;
    var ins = visibleInsets(el);
    var availW = el.clientWidth - ins.left - FIT_PAD * 2;
    var availH = el.clientHeight - ins.top - FIT_PAD * 2;

    var f = footprintOf(map, entries, el);
    var kx = f.distX > 0 && f.distX + f.extSide * 2 > availW
      ? Math.ceil(Math.log2(f.distX / Math.max(1, availW - f.extSide * 2))) : 0;
    var ky = f.distY > 0 && f.distY + f.extTop + 11 > availH
      ? Math.ceil(Math.log2(f.distY / Math.max(1, availH - f.extTop - 11))) : 0;
    var k = Math.min(6, Math.max(0, kx, ky));
    if (k > 0) map.setZoom(map.getZoom() - k, true);

    f = footprintOf(map, entries, el);
    var dx = ins.left + (el.clientWidth - ins.left) / 2 - (f.minX + f.maxX) / 2;
    var dy = ins.top + (el.clientHeight - ins.top) / 2 - (f.minY + f.maxY) / 2;
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

  /* 点卡片圆点或图上标记 → 放大定位到该基地 */
  function focusMarker(map, entry) {
    if (!entry) return;
    map.setZoomAndCenter(Math.max(map.getZoom(), 16), entry.marker.getPosition());
  }

  function bindLocationFocus(map, entries) {
    var byIndex = {};
    entries.forEach(function (e) { byIndex[e.index] = e; });
    Array.prototype.forEach.call(
      document.querySelectorAll('#contact-locations .loc-focus'),
      function (btn) {
        btn.addEventListener('click', function () {
          focusMarker(map, byIndex[Number(btn.getAttribute('data-loc-index'))]);
        });
      }
    );
  }

  /* 高德默认给标签加了灰边框/内边距，会破坏卡片观感，这里去掉 */
  function ensureMarkerLabelStyle() {
    if (document.getElementById('txam-amap-label-style')) return;
    var s = document.createElement('style');
    s.id = 'txam-amap-label-style';
    s.textContent = '#amap-container .amap-marker-label{border:0!important;background:transparent!important;' +
      'padding:0!important;box-shadow:none!important;white-space:normal}';
    document.head.appendChild(s);
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
      ensureMarkerLabelStyle();
      /* 不设 mapStyle：用高德默认配色（明亮有色彩）。
         之前的 amap://styles/whitesmoke 灰白样式是异步应用的，
         时有时无，用户观感「地图一会儿彩色一会儿发灰」——按需求去掉。 */
      var map = new AMap.Map('amap-container', {
        zoom: zoom,
        center: center,
        viewMode: '2D',
        features: ['bg', 'road', 'building'],
      });

      var entries = [];
      (page.locations || []).forEach(function (loc, i) {
        if (!hasLngLat(loc)) return;
        /* 常驻标签：地址不用点击就可见 */
        var marker = new AMap.Marker({
          position: [Number(loc.lnglat[0]), Number(loc.lnglat[1])],
          map: map,
          zIndex: 110 + i,
          offset: new AMap.Pixel(-11, -11),
          icon: dotIcon(loc.dotColor || (i === 0 ? '#14161B' : '#FF6B00'), 22),
          label: { direction: 'top', offset: new AMap.Pixel(0, -14), content: labelHtml(loc) },
        });
        var entry = { index: i, marker: marker };
        marker.on('click', function () { focusMarker(map, entry); });
        entries.push(entry);
      });

      /* 一个坐标都没配时，退回原来「在 map.center 打一个点」的行为 */
      if (!entries.length) {
        entries.push({
          index: -1,
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
