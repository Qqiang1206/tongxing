/**
 * TXAM Admin — zh source CMS (function-first)
 */
(function () {
  var API = '/api/v1';
  var token = sessionStorage.getItem('txam_admin_token') || '';
  var actorName = sessionStorage.getItem('txam_admin_actor') || '';
  var state = {
    view: 'dashboard',
    products: [],
    news: [],
    solutions: [],
    selectedProductId: null,
    selectedNewsId: null,
    selectedSolutionId: null,
    isNewProduct: false,
    isNewNews: false,
    isNewSolution: false,
    productCategories: [],
    newsCategories: [],
    solutionCategories: [],
    pageCache: {},
    siteCache: null,
    mediaItems: [],
    auditActors: [],
    hubTabs: {
      products: 'items',
      news: 'items',
      solutions: 'items',
      system: 'translation',
    },
    sectionTabs: {},
    dirtyPages: {},
    listStatus: { products: 'all', news: 'all', solutions: 'all' },
    listPages: { products: 1, news: 1, solutions: 1 },
    txSync: {
      active: false,
      preparing: false,
      items: [],
      done: 0,
      total: 0,
      failed: 0,
      currentLabel: '',
      startedAt: 0,
      itemStartedAt: 0,
      _timer: null,
    },
  };

  var $ = function (id) { return document.getElementById(id); };

  function toast(text, isErr) {
    var el = $('toast');
    el.textContent = text;
    el.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

  var PAGE_KEY_BY_VIEW = {
    'page-home': 'home',
    'page-about': 'about',
    'page-solutions': 'solutions',
    'page-products': 'products',
    'page-news': 'news',
    'page-contact': 'contact',
  };
  var PAGE_LABELS = {
    home: '首页',
    about: '关于我们',
    solutions: '解决方案页面',
    products: '产品中心页面',
    news: '新闻中心页面',
    contact: '联系我们',
  };
  var PAGE_FORM_IDS = {
    home: 'page-home-form',
    about: 'page-about-form',
    solutions: 'page-solutions-form',
    products: 'page-products-form',
    news: 'page-news-form',
    contact: 'page-contact-form',
  };
  var PAGE_VIEW_BY_KEY = {
    home: 'page-home',
    about: 'page-about',
    solutions: 'page-solutions',
    products: 'page-products',
    news: 'page-news',
    contact: 'page-contact',
  };

  function pageStatusElement(key) {
    return document.querySelector('[data-save-status="' + key + '"]');
  }

  var INLINE_SAVE_PAGES = { home: true, about: true, contact: true };

  function pageSaveBarElement(key) {
    return document.querySelector('[data-save-actions="' + key + '"]');
  }

  function showInlineSaveBar(key, visible) {
    if (!INLINE_SAVE_PAGES[key]) return;
    var bar = pageSaveBarElement(key);
    if (bar) bar.classList.toggle('hidden', !visible);
  }

  function flashInlineSaveBar(key) {
    if (!INLINE_SAVE_PAGES[key]) return;
    showInlineSaveBar(key, true);
    if (!state.saveBarTimers) state.saveBarTimers = {};
    clearTimeout(state.saveBarTimers[key]);
    state.saveBarTimers[key] = setTimeout(function () {
      if (!state.dirtyPages || !state.dirtyPages[key]) showInlineSaveBar(key, false);
    }, 3500);
  }

  function setPageStatus(key, text, mode) {
    var el = pageStatusElement(key);
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('is-dirty', mode === 'dirty');
    el.classList.toggle('is-saving', mode === 'saving');
    el.classList.toggle('is-error', mode === 'error');
    if (INLINE_SAVE_PAGES[key] && (mode === 'saving' || mode === 'error')) showInlineSaveBar(key, true);
  }

  function setPageDirty(key, dirty) {
    if (!state.dirtyPages) state.dirtyPages = {};
    state.dirtyPages[key] = !!dirty;
    var form = $(PAGE_FORM_IDS[key]);
    if (!dirty && form) {
      form.querySelectorAll('[data-section-tab]').forEach(function (tab) {
        tab.classList.remove('is-dirty');
      });
    }
    if (dirty) {
      setPageStatus(key, '有尚未保存的更改 · 保存后中文站立即更新，英/俄文需另行同步', 'dirty');
      showInlineSaveBar(key, true);
    } else {
      if (INLINE_SAVE_PAGES[key]) showInlineSaveBar(key, false);
      var status = pageStatusElement(key);
      if (status && (status.classList.contains('is-dirty') || status.classList.contains('is-error'))) {
        setPageStatus(key, '所有更改均已保存', 'saved');
      }
    }
  }

  function markActiveSectionDirty(root) {
    var activeTab = root && root.querySelector('[data-section-tab].is-active');
    if (activeTab) activeTab.classList.add('is-dirty');
  }

  function refreshOutlineBadges(root) {
    if (!root) return;
    var badgeMaps = {
      'page-home-form': { about: '#rep-stats', service: '#rep-home-steps' },
      'page-about-form': {
        carousel: '#rep-carousel', stats: '#rep-stats', culture: '#rep-culture-pillars',
        timeline: '#rep-timeline', credentials: '#rep-credentials', clients: '#rep-clients',
      },
      'page-contact-form': { channels: '#rep-channels', locations: '#rep-locations' },
    };
    var map = badgeMaps[root.id];
    if (!map) return;
    Object.keys(map).forEach(function (sectionKey) {
      var repeater = root.querySelector(map[sectionKey]);
      var tab = root.querySelector('[data-section-tab="' + sectionKey + '"]');
      var badge = tab && tab.querySelector('.hub-tab-count');
      if (!repeater || !badge) return;
      badge.textContent = repeater.querySelectorAll(':scope > .repeater-row').length;
    });
  }

  function bindPageDirty(formRootId, key) {
    var root = $(formRootId);
    if (!root) return;
    root._pageDirtyKey = key;
    if (!root._pageDirtyBound) {
      root._pageDirtyBound = true;
      ['input', 'change'].forEach(function (eventName) {
        root.addEventListener(eventName, function () {
          var pageKey = root._pageDirtyKey;
          if (!pageKey) return;
          setPageDirty(pageKey, true);
          markActiveSectionDirty(root);
        });
      });
      root.addEventListener('click', function (event) {
        var mutationButton = event.target.closest(
          '.rep-add, .rep-add-stats, .rep-add-generic, .rep-add-cred-group, .rep-add-cred-item, ' +
          '.rep-add-loc, .rep-add-process, .rep-remove, .rep-remove-item'
        );
        if (!mutationButton || !root.contains(mutationButton)) return;
        setPageDirty(root._pageDirtyKey, true);
        markActiveSectionDirty(root);
        setTimeout(function () { refreshOutlineBadges(root); }, 0);
      });
    }
    setPageDirty(key, false);
    refreshOutlineBadges(root);
  }

  function hasUnsavedPages() {
    return Object.keys(state.dirtyPages || {}).some(function (key) { return state.dirtyPages[key]; });
  }

  window.addEventListener('beforeunload', function (event) {
    if (!hasUnsavedPages()) return;
    event.preventDefault();
    event.returnValue = '';
  });

  function assetUrl(path) {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return '/' + String(path).replace(/^\//, '');
  }

  async function api(path, options) {
    options = options || {};
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (token) headers.Authorization = 'Bearer ' + token;
    if (actorName) headers['X-Admin-Actor'] = actorName;
    var res = await fetch(API + path, Object.assign({}, options, { headers: headers }));
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) {
      var err = new Error(data.message || data.error || ('HTTP ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function setActor(name) {
    actorName = String(name || '').trim().slice(0, 40);
    if (actorName) sessionStorage.setItem('txam_admin_actor', actorName);
    else sessionStorage.removeItem('txam_admin_actor');
    updateUserChip();
  }

  function updateUserChip() {
    var name = actorName || '管理员';
    if ($('user-name')) $('user-name').textContent = name;
    if ($('user-avatar')) $('user-avatar').textContent = name.charAt(0) || '管';
    if ($('sidebar-user')) $('sidebar-user').title = '当前操作人：' + name;
    if ($('sidebar-user-btn')) $('sidebar-user-btn').title = '退出登录（' + name + '）';
  }

  var WEEKDAY_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

  var AUDIT_ACTION_LABELS = {
    'login.ok': '登录成功',
    'login.fail': '登录失败',
    'products.create': '新建产品',
    'products.update': '更新产品',
    'products.delete': '删除产品',
    'solutions.create': '新建方案',
    'solutions.update': '更新方案',
    'solutions.delete': '删除方案',
    'news.create': '新建新闻',
    'news.update': '更新新闻',
    'news.delete': '删除新闻',
    'pages.update': '更新页面',
    'site.update': '更新站点文案',
    'media.upload': '上传媒体',
    'media.delete': '删除媒体',
    'media.update_alt': '更新媒体说明',
    'categories.product.create': '新建产品分类',
    'categories.product.update': '更新产品分类',
    'categories.product.delete': '删除产品分类',
    'categories.solution.create': '新建方案分类',
    'categories.solution.update': '更新方案分类',
    'categories.solution.delete': '删除方案分类',
    'categories.news.create': '新建新闻分类',
    'categories.news.update': '更新新闻分类',
    'categories.news.delete': '删除新闻分类',
    'translation.mark_current': '标记翻译已同步',
    'translation.run': '运行翻译任务',
    'translation.apply': '应用翻译结果',
    'translation.enqueue_stale': '入队待翻译项',
    'translation.create_job': '创建翻译任务',
  };

  var AUDIT_RESOURCE_LABELS = {
    auth: '登录',
    products: '产品',
    solutions: '方案',
    news: '新闻',
    pages: '页面',
    site: '导航/页脚',
    media: '媒体',
    translation: '翻译',
    categories: '分类',
  };

  function auditActionLabel(action) {
    if (!action) return '—';
    if (AUDIT_ACTION_LABELS[action]) return AUDIT_ACTION_LABELS[action];
    if (String(action).indexOf('pages.') === 0) return '更新页面';
    var prefix = String(action).split('.')[0];
    if (AUDIT_RESOURCE_LABELS[prefix]) {
      var verb = String(action).split('.').slice(1).join('.');
      var verbMap = {
        create: '新建', update: '更新', delete: '删除', ok: '成功', fail: '失败',
        upload: '上传', run: '运行', apply: '应用',
      };
      return AUDIT_RESOURCE_LABELS[prefix] + (verbMap[verb] ? ' · ' + verbMap[verb] : (verb ? ' · ' + verb : ''));
    }
    return action;
  }

  function auditResourceLabel(resource) {
    if (!resource) return '—';
    if (AUDIT_RESOURCE_LABELS[resource]) return AUDIT_RESOURCE_LABELS[resource];
    if (String(resource).indexOf('pages:') === 0) {
      var key = String(resource).slice(6);
      var pageNames = {
        home: '首页', about: '关于我们', contact: '联系我们',
        products: '产品中心', news: '新闻中心', solutions: '解决方案中心',
      };
      return '页面 · ' + (pageNames[key] || key);
    }
    return resource;
  }

  function formatAuditTime(iso) {
    if (!iso) return '—';
    var s = String(iso).replace(' ', 'T');
    if (!/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z';
    var d = new Date(s);
    if (isNaN(d.getTime())) return String(iso);
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  /** Show pick dialog. Resolves id or null if cancelled.
   * payload.action === 'vacate' → pick replacement to promote
   * payload.action === 'claim' / home_slot_full → pick occupant to demote
   */
  function promptSlotReplace(payload) {
    return new Promise(function (resolve) {
      var modal = $('slot-replace-modal');
      var list = $('slot-replace-list');
      var confirmBtn = $('slot-replace-confirm');
      var selected = null;
      var isVacate = payload.action === 'vacate' || payload.error === 'unpublish_needs_replace';
      var items = isVacate ? (payload.candidates || []) : (payload.occupants || []);
      $('slot-replace-title').textContent = isVacate ? '需要指定替代' : '精选已满';
      $('slot-replace-msg').textContent = payload.message ||
        (isVacate ? '请选择一条已发布内容替换首页推荐后再下架。' : '该类精选已满，请选择要让出的一项。');
      confirmBtn.textContent = isVacate ? '用选中项顶替并继续' : '让出选中项并精选当前';
      list.innerHTML = items.map(function (o) {
        var label = o.name || o.title || ('#' + o.id);
        var img = o.image || o.cover || '';
        return '<label class="slot-replace-item" data-id="' + escapeAttr(o.id) + '">' +
          '<input type="radio" name="slot-replace" value="' + escapeAttr(o.id) + '">' +
          (img ? '<img src="' + escapeHtml(assetUrl(img)) + '" alt="">' : '') +
          '<span><strong>' + escapeHtml(label) + '</strong></span>' +
          '</label>';
      }).join('') || '<p class="empty">' + (isVacate ? '没有可替代的已发布内容，请先发布其他条目' : '暂无占用项') + '</p>';
      confirmBtn.disabled = true;
      list.querySelectorAll('.slot-replace-item').forEach(function (row) {
        row.addEventListener('click', function () {
          selected = row.getAttribute('data-id');
          list.querySelectorAll('.slot-replace-item').forEach(function (r) {
            r.classList.toggle('is-selected', r === row);
          });
          var radio = row.querySelector('input');
          if (radio) radio.checked = true;
          confirmBtn.disabled = !selected;
        });
      });
      function close(val) {
        modal.classList.add('hidden');
        $('slot-replace-close').onclick = null;
        confirmBtn.onclick = null;
        resolve(val);
      }
      $('slot-replace-close').onclick = function () { close(null); };
      confirmBtn.onclick = function () { close(selected); };
      modal.classList.remove('hidden');
    });
  }

  async function saveWithSlotRetry(path, body, method) {
    method = method || 'PUT';
    try {
      return await api(path, { method: method, body: JSON.stringify(body) });
    } catch (err) {
      if (err.status === 409 && err.data &&
        (err.data.error === 'home_slot_full' || err.data.error === 'unpublish_needs_replace')) {
        var replaceId = await promptSlotReplace(err.data);
        if (!replaceId) throw new Error('已取消');
        body.replaceId = replaceId;
        return await api(path, { method: method, body: JSON.stringify(body) });
      }
      throw err;
    }
  }

  async function unpublishCatalog(kind, id) {
    if (!confirm('确认下架？下架后官网前台将不再展示该内容。')) return;
    var item = await api('/admin/' + kind + '/' + encodeURIComponent(id));
    if (item.published === false) {
      toast('已是下架状态');
      return;
    }
    var body = Object.assign({}, item, { published: false });
    await saveWithSlotRetry('/admin/' + kind + '/' + encodeURIComponent(id), body, 'PUT');
    toast('已下架');
    if (kind === 'products') {
      await loadProducts();
      await openProduct(id);
    } else if (kind === 'news') {
      await loadNews();
      await openNews(id);
    } else {
      await loadSolutions();
      await openSolution(id);
    }
  }

  function showLogin(show) {
    $('login-view').classList.toggle('hidden', !show);
    $('app-view').classList.toggle('hidden', show);
  }

  var HUB_BY_VIEW = {
    'page-products': 'products',
    'page-news': 'news',
    'page-solutions': 'solutions',
    system: 'system',
  };
  var VIEW_BY_LEGACY = {
    products: 'page-products',
    news: 'page-news',
    solutions: 'page-solutions',
    site: 'sitewide',
    categories: 'page-products',
    translation: 'system',
    audit: 'system',
  };
  var LEGACY_HUB_TAB = {
    site: 'site',
    categories: 'categories',
    translation: 'translation',
    audit: 'audit',
  };

  function applyHubTab(hub, tab) {
    if (!hub) return;
    if (tab) state.hubTabs[hub] = tab;
    var defaults = {
      products: 'items', news: 'items', solutions: 'items',
      system: 'translation',
    };
    var current = state.hubTabs[hub] || defaults[hub] || 'items';
    document.querySelectorAll('.hub-tabs[data-hub="' + hub + '"] .hub-tab').forEach(function (btn) {
      var active = btn.getAttribute('data-hub-tab') === current;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.hub-panel[data-hub="' + hub + '"]').forEach(function (panel) {
      var show = panel.getAttribute('data-hub-panel') === current;
      panel.classList.toggle('hidden', !show);
      if (show) resetPanelScroll(panel);
    });
    document.querySelectorAll('.hub-actions[data-hub="' + hub + '"] [data-hub-action]').forEach(function (el) {
      el.classList.toggle('hidden', el.getAttribute('data-hub-action') !== current);
    });
    document.querySelectorAll('.hub-actions[data-hub="' + hub + '"] .hub-action-page').forEach(function (el) {
      el.classList.toggle('hidden', current !== 'page');
    });
    document.querySelectorAll('.hub-actions[data-hub="' + hub + '"] .hub-action-items').forEach(function (el) {
      el.classList.toggle('hidden', current !== 'items');
    });
  }

  function updateHubCount(hub, count) {
    var el = $('hub-count-' + hub);
    if (!el) return;
    var n = count != null ? count : (
      hub === 'products' ? (state.products || []).length :
      hub === 'news' ? (state.news || []).length :
      hub === 'solutions' ? (state.solutions || []).length : 0
    );
    el.textContent = n ? String(n) : '';
  }

  async function loadHub(hub, preferredTab) {
    if (preferredTab) applyHubTab(hub, preferredTab);
    else applyHubTab(hub);
    if (hub === 'products') {
      await Promise.all([loadPageForm('products'), loadProducts(), loadCategories()]);
    } else if (hub === 'news') {
      await Promise.all([loadPageForm('news'), loadNews(), loadCategories()]);
    } else if (hub === 'solutions') {
      await Promise.all([loadPageForm('solutions'), loadSolutions(), loadCategories()]);
    } else if (hub === 'system') {
      await Promise.all([loadTranslation(), loadAudit()]);
    }
    updateHubCount(hub);
  }

  function setView(name, opts) {
    opts = opts || {};
    var preferredTab = opts.hubTab || null;
    if (LEGACY_HUB_TAB[name] && !preferredTab) preferredTab = LEGACY_HUB_TAB[name];
    if (VIEW_BY_LEGACY[name]) {
      if (!preferredTab && (name === 'products' || name === 'news' || name === 'solutions')) {
        preferredTab = 'items';
      }
      name = VIEW_BY_LEGACY[name];
    }
    var leavingPageKey = PAGE_KEY_BY_VIEW[state.view];
    if (leavingPageKey && state.dirtyPages[leavingPageKey] && name !== state.view) {
      if (!confirm('“' + PAGE_LABELS[leavingPageKey] + '”有尚未保存的更改，确定离开并放弃修改吗？')) {
        return Promise.resolve(false);
      }
      setPageDirty(leavingPageKey, false);
    }
    state.view = name;
    closeDrawer();
    document.querySelectorAll('.nav-item').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-view') === name);
    });
    document.querySelectorAll('.view').forEach(function (sec) {
      sec.classList.toggle('hidden', sec.id !== 'view-' + name);
    });
    var main = document.querySelector('.main');
    if (main) main.scrollTop = 0;
    var activeNav = document.querySelector('.nav-item[data-view="' + name + '"]');
    var hub = HUB_BY_VIEW[name];
    if (hub) {
      return Promise.resolve(loadHub(hub, preferredTab)).catch(function (e) { toast(e.message, true); });
    }
    var loaders = {
      dashboard: loadDashboard,
      'page-home': function () { return loadPageForm('home'); },
      'page-about': function () { return loadPageForm('about'); },
      'page-contact': function () { return loadPageForm('contact'); },
      sitewide: loadSiteForm,
      media: loadMedia,
    };
    if (loaders[name]) {
      return Promise.resolve(loaders[name]()).catch(function (e) { toast(e.message, true); });
    }
    return Promise.resolve();
  }

  function handleGlobalSearch(query) {
    var q = String(query || '').trim();
    if (!q) return;
    var wantsPageContent = /页面|文案|标题|导语/.test(q);
    if (/首页/.test(q)) return setView('page-home');
    if (/关于|公司介绍|企业文化|发展历程|资质|客户/.test(q)) return setView('page-about');
    if (/联系|地址|电话|邮箱|地图/.test(q)) return setView('page-contact');
    if (/解决方案|方案/.test(q)) return setView('page-solutions', { hubTab: wantsPageContent ? 'page' : 'items' });
    if (/方案.*分类|分类.*方案/.test(q)) return setView('page-solutions', { hubTab: 'categories' });
    if (/产品.*分类|分类.*产品/.test(q)) return setView('page-products', { hubTab: 'categories' });
    if (/(新闻|资讯).*分类|分类.*(新闻|资讯)/.test(q)) return setView('page-news', { hubTab: 'categories' });
    if (/产品/.test(q)) return setView('page-products', { hubTab: wantsPageContent ? 'page' : 'items' });
    if (/新闻|资讯|文章/.test(q)) return setView('page-news', { hubTab: wantsPageContent ? 'page' : 'items' });
    if (/导航|页脚|全站设置|公共内容/.test(q)) return setView('sitewide');
    if (/分类/.test(q)) return setView('page-products', { hubTab: 'categories' });
    if (/素材|图片|媒体/.test(q)) return setView('media');
    if (/翻译|同步/.test(q)) return setView('system', { hubTab: 'translation' });
    if (/日志|记录/.test(q)) return setView('system', { hubTab: 'audit' });
    toast('没有找到对应页面，可尝试搜索“关于我们”“产品”或“素材库”', true);
    return Promise.resolve(false);
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function escapeAttr(s) { return escapeHtml(s).replace(/'/g, '&#39;'); }
  function val(id) { var el = $(id); return el ? el.value : ''; }

  function field(name, label, value, span, type) {
    var id = 'f-' + name;
    var cls = 'field' + (span === 'full' ? ' full' : '');
    value = value == null ? '' : value;
    if (type === 'textarea' || type === 'textarea-code') {
      return '<div class="' + cls + '"><label for="' + id + '">' + escapeHtml(label) + '</label>' +
        '<textarea id="' + id + '" class="' + (type === 'textarea-code' ? 'code' : '') + '">' + escapeHtml(value) + '</textarea></div>';
    }
    return '<div class="' + cls + '"><label for="' + id + '">' + escapeHtml(label) + '</label>' +
      '<input id="' + id + '" type="text" value="' + escapeAttr(value) + '"></div>';
  }

  function cardBlock(title, inner) {
    return '<div class="card"><h3 class="card-title">' + escapeHtml(title) + '</h3><div class="form-grid">' + inner + '</div></div>';
  }

  /** Page sections mirror the visible frontend order; search settings stay last. */
  function buildSectionTabs(formRootId, sections, defaultKey) {
    var useOutline = /^(site-form|page-(home|about|contact|solutions|products|news)-form)$/.test(formRootId);
    var outlineMeta = {
      'site-form': {
        title: '全站公共区域',
        descriptions: {
          nav: '前台顶部六项菜单名称',
          common: '详情按钮、返回列表等共用文案',
          footer: '页脚标语、版权与备案内容',
        },
      },
      'page-home-form': {
        title: '首页结构',
        descriptions: {
          hero: '首页第一屏标题、按钮与主信息', featured: '标杆方案区域文案与按钮',
          slots: '查看首页正在展示的方案与新闻', about: '公司简介正文与核心数据',
          products: '核心业务与单元设备卡片', service: '服务流程标题与步骤',
          news: '精选新闻区域文案与跳转', seo: '浏览器标题、关键词与描述',
        },
      },
      'page-about-form': {
        title: '关于我们结构',
        descriptions: {
          hero: '页面第一屏标题与公司导语', carousel: '工厂环境图片与轮播文案',
          stats: '企业规模与能力数据', culture: '企业标语与文化支柱',
          timeline: '企业发展年份与事件', credentials: '资质证书与荣誉分组',
          clients: '合作客户标题与 Logo', seo: '浏览器标题、关键词与描述',
        },
      },
      'page-contact-form': {
        title: '联系我们结构',
        descriptions: {
          hero: '页面第一屏标题与联系导语', channels: '电话、邮箱等联系入口',
          map: '地图标题、坐标与缩放级别', locations: '公司与基地地址信息',
          seo: '浏览器标题、关键词与描述',
        },
      },
    };
    var commonDescriptions = {
      hero: '标题、导语与首屏展示', pillars: '核心价值与优势说明',
      filters: '前台筛选按钮文案', seo: '浏览器标题、关键词与描述',
    };
    var currentMeta = outlineMeta[formRootId] || { title: '页面结构', descriptions: {} };
    var sectionDescriptions = Object.assign({}, commonDescriptions, currentMeta.descriptions || {});
    var seoSections = sections.filter(function (s) { return s.key === 'seo'; });
    sections = sections.filter(function (s) { return s.key !== 'seo'; }).concat(seoSections);
    defaultKey = defaultKey || (sections[0] && sections[0].key) || '';
    var remembered = (state.sectionTabs && state.sectionTabs[formRootId]) || defaultKey;
    if (!sections.some(function (s) { return s.key === remembered; })) remembered = defaultKey;
    if (!state.sectionTabs) state.sectionTabs = {};
    state.sectionTabs[formRootId] = remembered;
    var tabButtonsHtml =
      sections.map(function (s, index) {
        var order = String(index + 1).padStart(2, '0');
        var badgeHtml = s.badge != null && s.badge !== ''
          ? '<span class="hub-tab-count">' + escapeHtml(s.badge) + '</span>' : '';
        return '<button type="button" class="hub-tab' + (s.key === remembered ? ' is-active' : '') +
          '" data-section-tab="' + escapeAttr(s.key) + '" role="tab" aria-selected="' + (s.key === remembered ? 'true' : 'false') + '">' +
          (useOutline
            ? '<span class="section-marker" aria-hidden="true"></span><span class="section-nav-copy"><strong>' +
              escapeHtml(s.label) + badgeHtml + '</strong><small>' + escapeHtml(sectionDescriptions[s.key] || '编辑当前页面区域') + '</small></span>'
            : '<span class="section-index">' + order + '</span><span>' + escapeHtml(s.label) + '</span>') +
          '</button>';
      }).join('');
    var tabsHtml = useOutline
      ? '<aside class="section-outline"><div class="section-outline-head"><strong>' + escapeHtml(currentMeta.title) + '</strong><span>按前台顺序定位 · 共 ' + sections.length + ' 个区域</span></div>' +
        '<div class="section-tabs section-outline-tabs" data-section-root="' + escapeAttr(formRootId) + '" role="tablist">' +
        tabButtonsHtml + '</div></aside>'
      : '<div class="hub-tabs section-tabs" data-section-root="' + escapeAttr(formRootId) + '" role="tablist">' +
        tabButtonsHtml + '</div>';
    var panelsHtml = sections.map(function (s) {
      return '<div class="section-panel' + (s.key === remembered ? '' : ' hidden') +
        '" data-section-panel="' + escapeAttr(s.key) + '">' + s.html + '</div>';
    }).join('');
    var panels = '<div class="section-panels-scroll">' + panelsHtml + '</div>';
    return useOutline ? '<div class="section-workspace section-workspace--outline">' + tabsHtml + panels + '</div>' : tabsHtml + panels;
  }

  function resetPanelScroll(panel) {
    if (!panel) return;
    panel.scrollTop = 0;
  }

  function bindSectionTabs(formRootId) {
    var root = $(formRootId);
    if (!root) return;
    var tabBar = root.querySelector('.section-tabs');
    if (!tabBar || tabBar._bound) return;
    tabBar._bound = true;
    tabBar.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-section-tab]');
      if (!btn || !tabBar.contains(btn)) return;
      var key = btn.getAttribute('data-section-tab');
      if (!state.sectionTabs) state.sectionTabs = {};
      state.sectionTabs[formRootId] = key;
      tabBar.querySelectorAll('.hub-tab').forEach(function (t) {
        var active = t.getAttribute('data-section-tab') === key;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      root.querySelectorAll('.section-panels-scroll > .section-panel').forEach(function (p) {
        var show = p.getAttribute('data-section-panel') === key;
        p.classList.toggle('hidden', !show);
        if (show) {
          resetPanelScroll(p);
          flushRichEditorsInPanel(p);
        }
      });
    });
  }

  function publishedCheck(id, checked) {
    return '<div class="field check-row"><input type="checkbox" id="' + id + '"' + (checked ? ' checked' : '') + '>' +
      '<label for="' + id + '" style="text-transform:none;letter-spacing:0;font-size:14px;color:var(--txam-dark)">已发布</label></div>';
  }

  function previewLink(href, label) {
    return '<a class="btn btn-ghost btn-sm" href="' + escapeAttr(href) + '" target="_blank" rel="noopener">' +
      escapeHtml(label || '预览页面') + '</a>';
  }

  function imageField(name, label, value) {
    value = value || '';
    return '<div class="field full image-field">' +
      '<label for="f-' + name + '">' + escapeHtml(label) + '</label>' +
      '<div class="image-field-row">' +
      '<input id="f-' + name + '" type="text" value="' + escapeAttr(value) + '" data-preview="preview-' + name + '">' +
      '<button type="button" class="btn btn-ghost btn-sm" data-pick="' + name + '">从媒体库选图</button>' +
      '</div>' +
      '<div class="preview-row" id="preview-' + name + '">' +
      (value ? '<img src="' + escapeHtml(assetUrl(value)) + '" alt="">' : '<span class="help">暂无预览</span>') +
      '</div></div>';
  }

  function bindImageFields(root) {
    (root || document).querySelectorAll('[data-pick]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openMediaPicker('f-' + btn.getAttribute('data-pick'));
      });
    });
    (root || document).querySelectorAll('input[data-preview]').forEach(function (input) {
      input.addEventListener('input', function () {
        var box = $(input.getAttribute('data-preview'));
        if (!box) return;
        var v = input.value.trim();
        box.innerHTML = v
          ? '<img src="' + escapeHtml(assetUrl(v)) + '" alt="">'
          : '<span class="help">暂无预览</span>';
      });
    });
  }

  function pairRowsHtml(prefix, items, titleLabel, descLabel) {
    items = items && items.length ? items : [{ title: '', desc: '' }];
    return '<div class="repeater" id="rep-' + prefix + '" data-prefix="' + prefix + '">' +
      items.map(function (item, i) {
        return '<div class="repeater-row" data-i="' + i + '">' +
          '<div class="form-grid">' +
          '<div class="field"><label>' + escapeHtml(titleLabel) + '</label>' +
          '<input class="rep-title" type="text" value="' + escapeAttr(item.title || '') + '"></div>' +
          '<div class="field full"><label>' + escapeHtml(descLabel) + '</label>' +
          '<textarea class="rep-desc">' + escapeHtml(item.desc || '') + '</textarea></div>' +
          '</div>' +
          '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add">＋ 添加一项</button></div>';
  }

  function bindPairRepeater(prefix) {
    var root = $('rep-' + prefix);
    if (!root) return;
    function reindex() {
      root.querySelectorAll('.repeater-row').forEach(function (row, i) {
        row.setAttribute('data-i', String(i));
      });
    }
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (t.classList.contains('rep-add')) {
        var row = document.createElement('div');
        row.className = 'repeater-row';
        row.innerHTML =
          '<div class="form-grid">' +
          '<div class="field"><label>标题</label><input class="rep-title" type="text" value=""></div>' +
          '<div class="field full"><label>说明</label><textarea class="rep-desc"></textarea></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';
        root.insertBefore(row, t);
        reindex();
      }
      if (t.classList.contains('rep-remove')) {
        var r = t.closest('.repeater-row');
        if (r && root.querySelectorAll('.repeater-row').length > 1) r.remove();
        else if (r) {
          r.querySelector('.rep-title').value = '';
          r.querySelector('.rep-desc').value = '';
        }
        reindex();
      }
    });
  }

  function collectPairRepeater(prefix) {
    var root = $('rep-' + prefix);
    if (!root) return [];
    return Array.prototype.map.call(root.querySelectorAll('.repeater-row'), function (row) {
      return {
        title: (row.querySelector('.rep-title') || {}).value || '',
        desc: (row.querySelector('.rep-desc') || {}).value || '',
      };
    }).filter(function (x) { return x.title || x.desc; });
  }

  function processRowsHtml(items) {
    items = items && items.length ? items : [{ step: '', title: '', desc: '' }];
    return '<div class="repeater" id="rep-process">' +
      items.map(function (item, index) {
        return '<div class="repeater-row">' +
          '<div class="repeater-row-head"><strong>流程 ' + String(index + 1).padStart(2, '0') + '</strong><span>序号由系统按当前顺序生成</span></div>' +
          '<div class="form-grid">' +
          '<div class="field full"><label>标题</label><input class="rep-title" type="text" value="' + escapeAttr(item.title || '') + '"></div>' +
          '<div class="field full"><label>说明</label><textarea class="rep-desc">' + escapeHtml(item.desc || '') + '</textarea></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-process">＋ 添加步骤</button></div>';
  }

  function bindProcessRepeater() {
    var root = $('rep-process');
    if (!root) return;
    function refreshRowHeadings() {
      root.querySelectorAll('.repeater-row').forEach(function (row, index) {
        var head = row.querySelector('.repeater-row-head');
        if (!head) return;
        var title = head.querySelector('strong');
        var help = head.querySelector('span');
        if (title) title.textContent = '流程 ' + String(index + 1).padStart(2, '0');
        if (help) help.textContent = '序号由系统按当前顺序生成';
      });
    }
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (t.classList.contains('rep-add-process')) {
        var row = document.createElement('div');
        row.className = 'repeater-row';
        row.innerHTML =
          '<div class="repeater-row-head"><strong>新增流程</strong><span>保存后自动生成序号</span></div>' +
          '<div class="form-grid">' +
          '<div class="field full"><label>标题</label><input class="rep-title" type="text" value=""></div>' +
          '<div class="field full"><label>说明</label><textarea class="rep-desc"></textarea></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';
        root.insertBefore(row, t);
        refreshRowHeadings();
      }
      if (t.classList.contains('rep-remove')) {
        var r = t.closest('.repeater-row');
        if (r && root.querySelectorAll('.repeater-row').length > 1) {
          r.remove();
          refreshRowHeadings();
        }
      }
    });
  }

  function collectProcessRepeater() {
    var root = $('rep-process');
    if (!root) return [];
    return Array.prototype.map.call(root.querySelectorAll('.repeater-row'), function (row) {
      return {
        title: (row.querySelector('.rep-title') || {}).value || '',
        desc: (row.querySelector('.rep-desc') || {}).value || '',
      };
    }).filter(function (x) { return x.title || x.desc; }).map(function (x, index) {
      x.step = String(index + 1).padStart(2, '0');
      return x;
    });
  }

  function statsRowsHtml(items) {
    items = items && items.length ? items : [{ value: '', unit: '', label: '' }];
    return '<div class="repeater" id="rep-stats">' +
      items.map(function (item, i) {
        return '<div class="repeater-row" data-source-index="' + i + '"><div class="form-grid">' +
          '<div class="field"><label>数值</label><input class="st-value" type="text" value="' + escapeAttr(item.value || '') + '"></div>' +
          '<div class="field"><label>单位</label><input class="st-unit" type="text" value="' + escapeAttr(item.unit || '') + '"></div>' +
          '<div class="field full"><label>说明</label><input class="st-label" type="text" value="' + escapeAttr(item.label || '') + '"></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm" id="rep-add-stat">＋ 添加数据</button></div>';
  }
  function bindStatsRepeater() {
    var root = $('rep-stats');
    if (!root) return;
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (t.classList.contains('rep-add-stats')) {
        var row = document.createElement('div');
        row.className = 'repeater-row';
        row.innerHTML = '<div class="form-grid">' +
          '<div class="field"><label>数值</label><input class="st-value" type="text"></div>' +
          '<div class="field"><label>单位</label><input class="st-unit" type="text"></div>' +
          '<div class="field full"><label>说明</label><input class="st-label" type="text"></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';
        root.insertBefore(row, t);
      }
      if (t.classList.contains('rep-remove')) {
        var r = t.closest('.repeater-row');
        if (r && root.querySelectorAll('.repeater-row').length > 1) r.remove();
      }
    });
  }

  function collectStatsRepeater() {
    var root = $('rep-stats');
    if (!root) return [];
    var prev = (((state.pageCache.home || {}).aboutSection || {}).stats) || [];
    return Array.prototype.map.call(root.querySelectorAll('.repeater-row'), function (row, i) {
      var item = {
        value: (row.querySelector('.st-value') || {}).value || '',
        unit: (row.querySelector('.st-unit') || {}).value || '',
        label: (row.querySelector('.st-label') || {}).value || '',
      };
      if (prev[i] && prev[i].emphasis) item.emphasis = prev[i].emphasis;
      return item;
    }).filter(function (x) { return x.value || x.label; });
  }

  var mediaPickerTarget = null;
  var mediaPickerCallback = null;
  var richEditorIds = [];
  var richEditorQueued = [];

  function richTextField(name, label, value, hint) {
    var id = 'f-' + name;
    value = value == null ? '' : value;
    return '<div class="field full rich-field">' +
      '<label for="' + id + '">' + escapeHtml(label) + '</label>' +
      (hint ? '<p class="field-help">' + escapeHtml(hint) + '</p>' : '') +
      '<textarea id="' + id + '" class="rich-source">' + escapeHtml(value) + '</textarea></div>';
  }

  function advancedBlock(innerHtml) {
    return '<details class="advanced-block"><summary>高级设置（一般不用改）</summary>' +
      '<div class="form-grid">' + innerHtml + '</div></details>';
  }

  function destroyRichEditors() {
    if (!window.tinymce) {
      richEditorIds = [];
      richEditorQueued = [];
      return;
    }
    richEditorIds.forEach(function (id) {
      var ed = tinymce.get(id);
      if (ed) ed.remove();
    });
    richEditorIds = [];
    richEditorQueued = [];
  }

  function mountRichEditor(id) {
    if (!window.tinymce || !$(id) || tinymce.get(id)) return;
    tinymce.init({
      selector: '#' + id,
      license_key: 'gpl',
      language: 'zh_CN',
      language_url: 'https://cdn.jsdelivr.net/npm/tinymce-i18n@25.1.1/langs7/zh_CN.js',
      menubar: false,
      branding: false,
      promotion: false,
      height: 340,
      plugins: 'lists link image table code autoresize',
      toolbar:
        'undo redo | blocks | bold italic underline | ' +
        'alignleft aligncenter alignright | bullist numlist | ' +
        'link image | removeformat | code',
      block_formats: '段落=p; 标题=h3; 小标题=h2',
      convert_urls: false,
      relative_urls: false,
      remove_script_host: false,
      content_style:
        'body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; font-size: 14px; line-height: 1.6; color: #1f2933; }' +
        'img { max-width: 100%; height: auto; }',
      file_picker_types: 'image',
      file_picker_callback: function (cb) {
        openMediaPicker(null, function (path) {
          cb(assetUrl(path), { alt: '', title: '' });
        });
      },
      setup: function (editor) {
        editor.on('change keyup', function () {
          editor.save();
          var source = editor.getElement();
          if (source) source.dispatchEvent(new Event('input', { bubbles: true }));
        });
      },
    });
  }

  function flushRichEditorsInPanel(panel) {
    if (!panel || !richEditorQueued.length) return;
    var still = [];
    richEditorQueued.forEach(function (id) {
      var el = $(id);
      if (el && panel.contains(el)) mountRichEditor(id);
      else still.push(id);
    });
    richEditorQueued = still;
  }

  function initRichEditors(ids) {
    destroyRichEditors();
    if (!window.tinymce) {
      toast('富文本组件未加载，请检查网络后刷新页面', true);
      return;
    }
    ids = ids || [];
    richEditorIds = ids.slice();
    richEditorQueued = [];
    ids.forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var panel = el.closest('.section-panel');
      if (panel && panel.classList.contains('hidden')) {
        richEditorQueued.push(id);
        return;
      }
      mountRichEditor(id);
    });
  }

  function getRichHtml(name) {
    var id = 'f-' + name;
    if (window.tinymce && tinymce.get(id)) {
      return tinymce.get(id).getContent();
    }
    return val(id);
  }

  async function openMediaPicker(inputId, onPick) {
    mediaPickerTarget = inputId || null;
    mediaPickerCallback = typeof onPick === 'function' ? onPick : null;
    $('media-picker').classList.remove('hidden');
    $('media-picker-grid').innerHTML = '<p class="help">加载中…</p>';
    try {
      var data = await api('/admin/media');
      var items = data.items || [];
      if (!items.length) {
        $('media-picker-grid').innerHTML = '<p class="help">媒体库为空，请先在「媒体库」上传图片</p>';
        return;
      }
      $('media-picker-grid').innerHTML = items.map(function (m) {
        return '<button type="button" class="media-pick-card" data-path="' + escapeAttr(m.path) + '">' +
          '<img src="' + escapeHtml(assetUrl(m.path)) + '" alt="">' +
          '<span>' + escapeHtml(m.path.split('/').pop()) + '</span></button>';
      }).join('');
      $('media-picker-grid').querySelectorAll('[data-path]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var path = btn.getAttribute('data-path');
          if (mediaPickerCallback) {
            mediaPickerCallback(path);
            closeMediaPicker();
            toast('已插入图片');
            return;
          }
          var input = $(mediaPickerTarget);
          if (input) {
            input.value = path;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
          closeMediaPicker();
          toast('已填入路径');
        });
      });
    } catch (err) {
      $('media-picker-grid').innerHTML = '<p class="help">' + escapeHtml(err.message) + '</p>';
    }
  }

  function closeMediaPicker() {
    mediaPickerTarget = null;
    mediaPickerCallback = null;
    $('media-picker').classList.add('hidden');
  }

  /* Dashboard */
  async function loadDashboard() {
    var results = await Promise.all([
      api('/admin/products'),
      api('/admin/news'),
      api('/admin/solutions'),
      api('/admin/translation-status'),
      api('/admin/analytics/summary'),
      api('/admin/dashboard/recent-updates?limit=6'),
    ]);
    state.products = results[0].items || [];
    state.news = results[1].items || [];
    state.solutions = results[2].items || [];
    var status = results[3];
    var analytics = results[4];
    state.dashboardRecent = (results[5].items || []);
    var stale = 0;
    Object.keys(status.resources || {}).forEach(function (key) {
      var r = status.resources[key];
      if (r.en === 'stale') stale++;
      if (r.ru === 'stale') stale++;
    });
    var pubProducts = state.products.filter(function (p) { return p.published !== false; }).length;
    var pubNews = state.news.filter(function (n) { return n.published !== false; }).length;
    var pubSolutions = state.solutions.filter(function (s) { return s.published !== false; }).length;
    var operator = actorName || '管理员';
    var now = new Date();
    if ($('dash-greeting')) {
      $('dash-greeting').textContent = '欢迎回来，' + operator;
    }
    if ($('dash-date')) {
      $('dash-date').textContent =
        now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 · ' +
        WEEKDAY_LABELS[now.getDay()] + ' · 天天开心';
    }
    var todayVisits = analytics.today;
    var visitHint = '昨日 ' + analytics.yesterday + ' · 近7日 ' + analytics.week;
    $('dash-stats').innerHTML =
      stat('今日访问', todayVisits, visitHint, false, 'visit') +
      stat('产品数量', state.products.length, '已发布 ' + pubProducts + ' 条') +
      stat('解决方案', state.solutions.length, '已发布 ' + pubSolutions + ' 条') +
      stat('新闻文章', state.news.length, '已发布 ' + pubNews + ' 条') +
      stat('待同步翻译', stale, stale ? '请到「系统 → 翻译同步」处理' : 'en / ru 均已最新', stale > 0);
    if ($('dash-traffic')) {
      $('dash-traffic').innerHTML =
        '<div class="traffic-summary">' +
        '<div class="traffic-stat"><span class="traffic-label">今日</span><strong>' + analytics.today + '</strong></div>' +
        '<div class="traffic-stat"><span class="traffic-label">昨日</span><strong>' + analytics.yesterday + '</strong></div>' +
        '<div class="traffic-stat"><span class="traffic-label">近7日</span><strong>' + analytics.week + '</strong></div>' +
        '</div>' +
        renderTrafficList('今日热门页面', analytics.topToday) +
        renderTrafficList('近7日热门页面', analytics.topWeek);
    }
    renderRecentUpdates(state.dashboardRecent);
    syncDashboardScrollAreas();
  }

  var dashboardScrollRaf = 0;

  function syncDashboardScrollAreas() {
    cancelAnimationFrame(dashboardScrollRaf);
    dashboardScrollRaf = requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var view = document.getElementById('view-dashboard');
        if (!view || view.classList.contains('hidden')) return;
        view.querySelectorAll('.dash-recent-scroll, .dash-traffic-card #dash-traffic').forEach(function (el) {
          el.classList.toggle('is-scrollable', el.scrollHeight > el.clientHeight + 1);
        });
      });
    });
  }

  function bindDashboardScrollSync() {
    if (bindDashboardScrollSync.bound) return;
    bindDashboardScrollSync.bound = true;
    window.addEventListener('resize', syncDashboardScrollAreas);
    var view = document.getElementById('view-dashboard');
    if (view && window.ResizeObserver) {
      var observer = new ResizeObserver(syncDashboardScrollAreas);
      observer.observe(view);
      var grid = view.querySelector('.dash-grid');
      if (grid) observer.observe(grid);
    }
  }

  function formatDashTime(iso) {
    if (!iso) return '—';
    var full = formatAuditTime(iso);
    if (full === '—') return full;
    var now = new Date();
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    var today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
    if (full.indexOf(today) === 0) return '今天 ' + full.slice(11, 16);
    return full.slice(5, 16);
  }

  function recentUpdateDeleted(row) {
    return /\.delete$/.test(row.action || '');
  }

  function recentUpdateTypeLabel(row) {
    var action = row.action || '';
    if (action.indexOf('products.') === 0) return '产品';
    if (action.indexOf('solutions.') === 0) return '方案';
    if (action.indexOf('news.') === 0) return '新闻';
    if (action.indexOf('pages.') === 0) return '页面';
    if (action.indexOf('site.') === 0) return '全站';
    if (action.indexOf('media.') === 0) return '媒体';
    if (action.indexOf('categories.product.') === 0) return '产品分类';
    if (action.indexOf('categories.solution.') === 0) return '方案分类';
    if (action.indexOf('categories.news.') === 0) return '新闻分类';
    return auditResourceLabel(row.resource);
  }

  function recentUpdateActionLabel(row) {
    if (recentUpdateDeleted(row)) return '删除';
    if (/\.create$/.test(row.action || '')) return '新建';
    if (/\.update/.test(row.action || '') || /\.upload$/.test(row.action || '')) return '更新';
    return auditActionLabel(row.action).replace(/^(新建|更新|删除)/, function (m) { return m; });
  }

  function jumpToRecentUpdate(row) {
    if (!row || recentUpdateDeleted(row)) return Promise.resolve();
    var action = row.action || '';
    var id = row.resourceId;
    if (action.indexOf('products.') === 0) {
      return Promise.resolve(setView('page-products', { hubTab: 'items' })).then(function () {
        if (id) return openProduct(id);
      });
    }
    if (action.indexOf('solutions.') === 0) {
      return Promise.resolve(setView('page-solutions', { hubTab: 'items' })).then(function () {
        if (id) return openSolution(id);
      });
    }
    if (action.indexOf('news.') === 0) {
      return Promise.resolve(setView('page-news', { hubTab: 'items' })).then(function () {
        if (id) return openNews(id);
      });
    }
    if (action.indexOf('pages.') === 0) {
      var pageKey = id || String(row.resource || '').replace(/^pages:/, '');
      var hubPages = { solutions: 'page-solutions', products: 'page-products', news: 'page-news' };
      if (hubPages[pageKey]) {
        return Promise.resolve(setView(hubPages[pageKey], { hubTab: 'page' }));
      }
      var view = PAGE_VIEW_BY_KEY[pageKey];
      if (view) return Promise.resolve(setView(view));
    }
    if (action.indexOf('site.') === 0) {
      return Promise.resolve(setView('sitewide'));
    }
    if (action.indexOf('media.') === 0) {
      return Promise.resolve(setView('media'));
    }
    if (action.indexOf('categories.product.') === 0) {
      return Promise.resolve(setView('page-products', { hubTab: 'categories' }));
    }
    if (action.indexOf('categories.solution.') === 0) {
      return Promise.resolve(setView('page-solutions', { hubTab: 'categories' }));
    }
    if (action.indexOf('categories.news.') === 0) {
      return Promise.resolve(setView('page-news', { hubTab: 'categories' }));
    }
    return Promise.resolve();
  }

  function renderRecentUpdates(items) {
    var box = $('dash-recent');
    if (!box) return;
    items = items || [];
    if (!items.length) {
      box.innerHTML = '<p class="help">暂无内容变更记录。保存页面、产品、方案或新闻后会出现在这里。</p>';
      syncDashboardScrollAreas();
      return;
    }
    box.innerHTML =
      '<ul class="recent-list">' +
      items.map(function (row, index) {
        var deleted = recentUpdateDeleted(row);
        var typeLabel = recentUpdateTypeLabel(row);
        var actionLabel = recentUpdateActionLabel(row);
        var summary = row.summary || auditActionLabel(row.action);
        return '<li class="recent-item' + (deleted ? ' is-deleted' : '') + (deleted ? '' : ' is-clickable') + '"' +
          (deleted ? '' : ' data-recent-idx="' + index + '"') + '>' +
          '<span class="recent-time">' + escapeHtml(formatDashTime(row.createdAt)) + '</span>' +
          '<span class="recent-type">' + escapeHtml(typeLabel) + '</span>' +
          '<span class="recent-body">' +
          '<span class="recent-action">' + escapeHtml(actionLabel) + '</span>' +
          '<span class="recent-summary">' + escapeHtml(summary) + '</span>' +
          '</span>' +
          '<span class="recent-actor">' + escapeHtml(row.actor || '—') + '</span>' +
          (deleted ? '' : '<span class="recent-go" aria-hidden="true">›</span>') +
          '</li>';
      }).join('') +
      '</ul>';
    box.querySelectorAll('[data-recent-idx]').forEach(function (el) {
      el.addEventListener('click', function () {
        var idx = Number(el.getAttribute('data-recent-idx'));
        var row = state.dashboardRecent && state.dashboardRecent[idx];
        jumpToRecentUpdate(row).catch(function (e) { toast(e.message, true); });
      });
    });
  }

  var TRAFFIC_PAGE_LABELS = {
    '/': '首页',
    '/about.html': '关于我们',
    '/products.html': '产品中心',
    '/product-detail.html': '产品详情',
    '/solutions.html': '解决方案',
    '/solution-detail.html': '方案详情',
    '/news.html': '新闻中心',
    '/news-detail.html': '新闻详情',
    '/contact.html': '联系我们',
  };

  function trafficPageLabel(row) {
    var pagePath = row.path || '';
    var suppliedLabel = row.label || '';
    if (suppliedLabel && suppliedLabel !== pagePath) return suppliedLabel;
    var languageMatch = pagePath.match(/^\/(en|ru)(?=\/|$)/);
    var language = languageMatch && languageMatch[1];
    var localPath = language ? pagePath.slice(language.length + 1) || '/' : pagePath;
    var pageLabel = TRAFFIC_PAGE_LABELS[localPath];
    if (!pageLabel) return pagePath;
    if (language === 'en') return '英文站 · ' + pageLabel;
    if (language === 'ru') return '俄文站 · ' + pageLabel;
    return pageLabel;
  }

  function renderTrafficList(title, rows) {
    var list = rows && rows.length ? rows.slice(0, 5) : [];
    var body = list.length
      ? list.map(function (row) {
        var pagePath = row.path || '';
        return '<li><span class="traffic-page"' + (pagePath ? ' title="' + escapeHtml(pagePath) + '"' : '') + '>' + escapeHtml(trafficPageLabel(row)) +
          '</span><span class="traffic-hits">' + escapeHtml(String(row.hits)) + '</span></li>';
      }).join('')
      : '<li class="traffic-empty">暂无访问记录</li>';
    return '<div class="traffic-block"><div class="traffic-block-title">' + escapeHtml(title) +
      '</div><ul class="traffic-list">' + body + '</ul></div>';
  }

  function stat(label, value, hint, warn, extraClass) {
    return '<div class="stat-card' + (warn ? ' warn' : '') + (extraClass ? ' ' + extraClass : '') + '"><div class="label">' + escapeHtml(label) +
      '</div><div class="value">' + escapeHtml(String(value)) + '</div><div class="hint">' + escapeHtml(hint) + '</div></div>';
  }

  function statusBadge(published) {
    return published !== false
      ? '<span class="badge badge-ok">已发布</span>'
      : '<span class="badge badge-draft">未发布</span>';
  }

  function thumbHtml(src, alt) {
    if (src) return '<img class="thumb" src="' + escapeHtml(assetUrl(src)) + '" alt="' + escapeAttr(alt || '') + '">';
    return '<div class="thumb placeholder">无图</div>';
  }

  function openDrawer(kind, title, opts) {
    var drawer = $('editor-drawer');
    if (!drawer) return;
    opts = opts || {};
    destroyRichEditors();
    drawer.classList.remove('hidden');
    drawer.setAttribute('aria-hidden', 'false');
    drawer.classList.toggle('drawer--compact', kind === 'category');
    drawer.classList.toggle('drawer--catalog', kind === 'product' || kind === 'news' || kind === 'solution');

    if ($('drawer-eyebrow')) {
      $('drawer-eyebrow').textContent = opts.eyebrow || (kind === 'category' ? '分类管理' : '编辑内容');
    }
    if ($('drawer-title')) $('drawer-title').textContent = title || '编辑';
    if ($('drawer-context')) {
      $('drawer-context').textContent = opts.context || '';
      $('drawer-context').classList.toggle('hidden', !opts.context);
    }

    var nav = $('drawer-section-nav');
    var sections = opts.sections || [];
    if (nav) {
      nav.innerHTML = sections.map(function (section, index) {
        return '<button type="button" class="drawer-section-link' + (index === 0 ? ' is-active' : '') +
          '" data-drawer-section="' + escapeAttr(section.key) + '">' +
          '<span>' + String(index + 1).padStart(2, '0') + '</span>' + escapeHtml(section.label) + '</button>';
      }).join('');
      nav.classList.toggle('hidden', !sections.length);
    }

    ['product-editor', 'news-editor', 'solution-editor', 'category-editor'].forEach(function (id) {
      var slot = $(id);
      if (!slot) return;
      var active = id === kind + '-editor';
      slot.classList.toggle('hidden', !active);
      if (!active) slot.innerHTML = '';
    });
    var body = drawer.querySelector('.drawer-body');
    if (body) {
      if (body._drawerSectionScroll) body.removeEventListener('scroll', body._drawerSectionScroll);
      body._drawerSectionScroll = null;
      body.scrollTop = 0;
    }
  }

  function editorSection(key, title, description, innerHtml) {
    return '<section class="catalog-editor-section" data-editor-section="' + escapeAttr(key) + '">' +
      '<div class="catalog-editor-section-head"><div><span class="catalog-section-index">' +
      escapeHtml(key === 'basic' ? '01' : key === 'content' ? '02' : '03') +
      '</span><h4>' + escapeHtml(title) + '</h4></div>' +
      (description ? '<p>' + escapeHtml(description) + '</p>' : '') + '</div>' +
      '<div class="catalog-editor-card">' + innerHtml + '</div></section>';
  }

  function catalogSaveBar(kind, label, isNew) {
    return '<div class="catalog-savebar">' +
      '<p class="catalog-save-state" id="' + escapeAttr(kind) + '-save-state"><span></span>' +
      (isNew ? '填写完成后保存即可创建' : '所有更改均已保存') + '</p>' +
      '<div class="toolbar"><button type="button" class="btn btn-ghost" id="cancel-' + escapeAttr(kind) + '">取消</button>' +
      '<button type="button" class="btn btn-accent" id="save-' + escapeAttr(kind) + '">' +
      (isNew ? '创建' : '保存') + escapeHtml(label) + '</button></div></div>';
  }

  function catalogActionZone(kind, label, item, isNew, previewHref) {
    if (isNew) {
      return '<div class="catalog-new-note"><strong>创建后再进行预览和下架操作</strong>' +
        '<p>新建内容默认不会自动发布，可以先保存为未发布内容。</p></div>';
    }
    return '<div class="catalog-action-zone"><div><strong>内容操作</strong>' +
      '<p>预览不会保存当前修改；删除操作不可撤销。</p></div><div class="toolbar">' +
      (previewHref ? previewLink(previewHref, '预览详情页') : '') +
      '<button type="button" class="btn btn-ghost btn-sm" id="reload-' + escapeAttr(kind) + '">重新加载</button>' +
      (item.published ? '<button type="button" class="btn btn-ghost btn-sm btn-danger-text" id="unpublish-' +
        escapeAttr(kind) + '">下架</button>' : '') +
      '<button type="button" class="btn btn-ghost btn-sm btn-danger-text" id="delete-' +
        escapeAttr(kind) + '">删除' + escapeHtml(label) + '</button></div></div>';
  }

  function setCatalogSaveState(kind, text, mode) {
    var el = $(kind + '-save-state');
    if (!el) return;
    el.lastChild.textContent = text;
    el.classList.toggle('is-dirty', mode === 'dirty');
    el.classList.toggle('is-saving', mode === 'saving');
    el.classList.toggle('is-error', mode === 'error');
  }

  function bindCatalogEditorState(rootId, kind) {
    var root = $(rootId);
    if (!root) return;
    root._catalogKind = kind;
    if (!root._catalogDirtyBound) {
      root._catalogDirtyBound = true;
      ['input', 'change'].forEach(function (eventName) {
        root.addEventListener(eventName, function () {
          if (!root._catalogKind) return;
          setCatalogSaveState(root._catalogKind, '有尚未保存的更改', 'dirty');
        });
      });
    }
  }

  async function runCatalogSave(kind, label, saveFn) {
    var button = $('save-' + kind);
    var normalLabel = button ? button.textContent : ('保存' + label);
    if (button) {
      button.disabled = true;
      button.textContent = '正在保存…';
    }
    setCatalogSaveState(kind, '正在保存' + label + '…', 'saving');
    try {
      var saved = await saveFn();
      if (saved === false) {
        setCatalogSaveState(kind, '有尚未保存的更改', 'dirty');
        return;
      }
      var now = new Date();
      var savedAt = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      setCatalogSaveState(kind, '已保存于 ' + savedAt, 'saved');
    } catch (err) {
      setCatalogSaveState(kind, '保存失败，请检查后重试', 'error');
      toast(err.message || '保存失败', true);
    } finally {
      var currentButton = $('save-' + kind);
      if (currentButton) {
        currentButton.disabled = false;
        if (currentButton === button) currentButton.textContent = normalLabel;
      }
    }
  }

  function bindDrawerSectionNav(rootId) {
    var root = $(rootId);
    var nav = $('drawer-section-nav');
    var drawer = $('editor-drawer');
    var body = drawer && drawer.querySelector('.drawer-body');
    if (!root || !nav || !body) return;
    var buttons = Array.prototype.slice.call(nav.querySelectorAll('[data-drawer-section]'));
    var panels = Array.prototype.slice.call(root.querySelectorAll('[data-editor-section]'));
    if (!buttons.length || !panels.length) return;

    function setActive(key) {
      buttons.forEach(function (button) {
        button.classList.toggle('is-active', button.getAttribute('data-drawer-section') === key);
      });
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        var key = button.getAttribute('data-drawer-section');
        var panel = root.querySelector('[data-editor-section="' + key + '"]');
        if (!panel) return;
        var bodyRect = body.getBoundingClientRect();
        var panelRect = panel.getBoundingClientRect();
        body.scrollTo({ top: body.scrollTop + panelRect.top - bodyRect.top - 18, behavior: 'smooth' });
        setActive(key);
      });
    });

    body._drawerSectionScroll = function () {
      var bodyTop = body.getBoundingClientRect().top + 42;
      var active = panels[0];
      panels.forEach(function (panel) {
        if (panel.getBoundingClientRect().top <= bodyTop) active = panel;
      });
      if (active) setActive(active.getAttribute('data-editor-section'));
    };
    body.addEventListener('scroll', body._drawerSectionScroll, { passive: true });
  }
  function closeDrawer() {
    var drawer = $('editor-drawer');
    if (!drawer) return;
    destroyRichEditors();
    if (state.isNewProduct) {
      state.isNewProduct = false;
      state.selectedProductId = null;
      renderProductTable();
    }
    if (state.isNewNews) {
      state.isNewNews = false;
      state.selectedNewsId = null;
      renderNewsTable();
    }
    if (state.isNewSolution) {
      state.isNewSolution = false;
      state.selectedSolutionId = null;
      renderSolutionTable();
    }
    drawer.classList.add('hidden');
    drawer.setAttribute('aria-hidden', 'true');
  }

  /* Generic catalog list helpers */
  var CATALOG_PAGE_SIZE = 5;

  function applyListStatusFilter(rows, status) {
    if (status === 'published') return rows.filter(function (r) { return r.published !== false; });
    if (status === 'draft') return rows.filter(function (r) { return r.published === false; });
    return rows;
  }

  function updateListStatusCounts(kind, rows) {
    var bar = document.querySelector('[data-list-status="' + kind + '"]');
    if (!bar) return;
    var all = rows.length;
    var published = 0;
    var draft = 0;
    rows.forEach(function (r) {
      if (r.published === false) draft += 1;
      else published += 1;
    });
    var counts = { all: all, published: published, draft: draft };
    bar.querySelectorAll('[data-status-count]').forEach(function (el) {
      var key = el.getAttribute('data-status-count');
      var n = counts[key] || 0;
      el.textContent = n ? String(n) : '0';
    });
  }

  function paginateRows(rows, page, pageSize) {
    var total = rows.length;
    var totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
    var safePage = Math.min(Math.max(1, page || 1), totalPages);
    var start = (safePage - 1) * pageSize;
    return {
      rows: rows.slice(start, start + pageSize),
      page: safePage,
      totalPages: totalPages,
      total: total,
    };
  }

  function catalogDomPrefix(kind) {
    if (kind === 'products') return 'product';
    if (kind === 'solutions') return 'solution';
    return kind;
  }

  function renderCatalogPagination(kind, pageInfo) {
    var prefix = catalogDomPrefix(kind);
    var root = $(prefix + '-pagination');
    var foot = $(prefix + '-table-foot');
    if (foot) {
      foot.textContent = pageInfo.total
        ? ('共 ' + pageInfo.total + ' 条 · 第 ' + pageInfo.page + ' / ' + pageInfo.totalPages + ' 页')
        : '暂无内容';
    }
    if (!root) return;
    if (pageInfo.totalPages <= 1) {
      root.innerHTML = '';
      return;
    }
    var prevDisabled = pageInfo.page <= 1;
    var nextDisabled = pageInfo.page >= pageInfo.totalPages;
    root.innerHTML =
      '<button type="button" class="btn-page" data-page="' + kind + '" data-dir="prev"' +
      (prevDisabled ? ' disabled' : '') + '>上一页</button>' +
      '<span class="page-indicator">' + pageInfo.page + ' / ' + pageInfo.totalPages + '</span>' +
      '<button type="button" class="btn-page" data-page="' + kind + '" data-dir="next"' +
      (nextDisabled ? ' disabled' : '') + '>下一页</button>';
    root.querySelectorAll('[data-page="' + kind + '"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn.disabled) return;
        var dir = btn.getAttribute('data-dir');
        if (dir === 'prev' && state.listPages[kind] > 1) state.listPages[kind] -= 1;
        if (dir === 'next' && state.listPages[kind] < pageInfo.totalPages) state.listPages[kind] += 1;
        if (kind === 'products') renderProductTable();
        else if (kind === 'news') renderNewsTable();
        else if (kind === 'solutions') renderSolutionTable();
      });
    });
  }

  function bindListStatusTabs() {
    document.querySelectorAll('[data-list-status]').forEach(function (bar) {
      if (bar._bound) return;
      bar._bound = true;
      var kind = bar.getAttribute('data-list-status');
      bar.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-status]');
        if (!btn || !bar.contains(btn)) return;
        var status = btn.getAttribute('data-status');
        state.listStatus[kind] = status;
        state.listPages[kind] = 1;
        bar.querySelectorAll('[data-status]').forEach(function (tab) {
          var active = tab.getAttribute('data-status') === status;
          tab.classList.toggle('is-active', active);
          tab.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        if (kind === 'products') renderProductTable();
        else if (kind === 'news') renderNewsTable();
        else if (kind === 'solutions') renderSolutionTable();
      });
    });
  }

  function filterItems(items, q, fields) {
    q = (q || '').trim().toLowerCase();
    if (!q) return items;
    return items.filter(function (item) {
      return fields.map(function (f) { return item[f] || ''; }).join(' ').toLowerCase().indexOf(q) !== -1;
    });
  }

  function itemCardHtml(opts) {
    var sel = opts.active ? ' is-active' : '';
    return '<button type="button" class="item-row' + sel + '" role="listitem" data-edit="' +
      escapeAttr(String(opts.id)) + '">' +
      thumbHtml(opts.image, opts.title) +
      '<div class="item-main">' +
      '<div class="item-title-row">' +
      '<span class="item-title">' + escapeHtml(opts.title || '未命名') + '</span>' +
      (opts.badgeHtml || '') +
      statusBadge(opts.published) +
      '</div>' +
      '<div class="item-meta">' + escapeHtml(opts.meta || '') + '</div>' +
      '</div>' +
      '<div class="item-actions"><span class="btn-edit">编辑</span></div>' +
      '</button>';
  }

  function bindItemList(listEl, openFn) {
    if (!listEl) return;
    listEl.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openFn(btn.getAttribute('data-edit'));
      });
    });
  }

  /* Products */
  async function loadProducts() {
    state.products = (await api('/admin/products')).items || [];
    renderProductTable();
    updateHubCount('products');
  }

  function renderProductTable() {
    var list = $('product-list');
    if (!list) return;
    var rows = filterItems(state.products, $('product-search').value, ['id', 'name', 'model', 'category']);
    updateListStatusCounts('products', rows);
    rows = applyListStatusFilter(rows, state.listStatus.products || 'all');
    var pageInfo = paginateRows(rows, state.listPages.products, CATALOG_PAGE_SIZE);
    if (pageInfo.page !== state.listPages.products) state.listPages.products = pageInfo.page;
    list.innerHTML = pageInfo.rows.map(function (p) {
      var meta = [p.model, p.category].filter(Boolean).join(' · ');
      return itemCardHtml({
        id: p.id,
        title: p.name,
        image: p.image,
        published: p.published,
        meta: meta,
        active: String(p.id) === String(state.selectedProductId),
      });
    }).join('') || '<p class="empty">没有匹配的产品</p>';
    bindItemList(list, openProduct);
    renderCatalogPagination('products', pageInfo);
  }

  function productCategorySelect(item) {
    var selected = item.filterKey || '';
    if (!selected && item.category) {
      var hit = state.productCategories.find(function (c) { return c.name === item.category; });
      if (hit) selected = hit.key;
    }
    var opts = state.productCategories.map(function (c) {
      return '<option value="' + escapeAttr(c.key) + '"' + (c.key === selected ? ' selected' : '') + '>' +
        escapeHtml(c.name) + '</option>';
    }).join('');
    return '<div class="field"><label for="f-categoryKey">分类名称</label>' +
      '<select id="f-categoryKey">' +
      '<option value="">请选择分类</option>' + opts +
      '</select>' +
      '<p class="field-help">在「产品中心 → 分类管理」中维护可选分类</p></div>';
  }

  function solutionCategorySelect(item) {
    var selected = item.filterKey || '';
    if (!selected && item.category) {
      var hit = state.solutionCategories.find(function (c) { return c.name === item.category; });
      if (hit) selected = hit.key;
    }
    var opts = state.solutionCategories.map(function (c) {
      return '<option value="' + escapeAttr(c.key) + '"' + (c.key === selected ? ' selected' : '') + '>' +
        escapeHtml(c.name) + '</option>';
    }).join('');
    return '<div class="field"><label for="f-categoryKey">分类名称</label>' +
      '<select id="f-categoryKey">' +
      '<option value="">请选择分类</option>' + opts +
      '</select>' +
      '<p class="field-help">在「解决方案 → 分类管理」中维护可选分类</p></div>';
  }

  function newsCategorySelect(item) {
    var selected = item.category || '';
    var opts = state.newsCategories.map(function (c) {
      return '<option value="' + escapeAttr(c.name) + '"' + (c.name === selected ? ' selected' : '') + '>' +
        escapeHtml(c.name) + '</option>';
    }).join('');
    return '<div class="field"><label for="f-category">分类</label>' +
      '<select id="f-category">' +
      '<option value="">请选择分类</option>' + opts +
      '</select>' +
      '<p class="field-help">在「新闻中心 → 分类管理」中维护可选分类</p></div>';
  }

  async function ensureCategoriesLoaded() {
    if (state.productCategories.length && state.newsCategories.length && state.solutionCategories.length) return;
    var data = await api('/admin/categories');
    state.productCategories = data.products || [];
    state.newsCategories = data.news || [];
    state.solutionCategories = data.solutions || [];
  }

  async function loadCategories() {
    var data = await api('/admin/categories');
    state.productCategories = data.products || [];
    state.newsCategories = data.news || [];
    state.solutionCategories = data.solutions || [];
    renderProductCatList();
    renderNewsCatList();
    renderSolutionCatList();
  }

  function renderProductCatList() {
    var root = $('product-cat-list');
    if (!root) return;
    var items = state.productCategories;
    if (!items.length) {
      root.innerHTML = '<p class="empty">暂无产品分类</p>';
      return;
    }
    root.innerHTML = items.map(function (c, index) {
      return '<div class="item-row" style="cursor:default">' +
        '<span class="category-order">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<div class="item-main">' +
        '<div class="item-title-row"><span class="item-title">' + escapeHtml(c.name) + '</span></div>' +
        '<div class="item-meta">显示顺序 ' + escapeHtml(String(c.sortOrder)) +
        '' + '</div></div>' +
        '<div class="item-actions">' +
        '<button type="button" class="btn-edit" data-edit-pc="' + escapeAttr(c.key) + '">编辑</button>' +
        '</div></div>';
    }).join('');
    root.querySelectorAll('[data-edit-pc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-edit-pc');
        var cat = state.productCategories.find(function (c) { return c.key === key; });
        if (cat) editProductCategory(cat);
      });
    });
  }
  function renderNewsCatList() {
    var root = $('news-cat-list');
    if (!root) return;
    var items = state.newsCategories;
    if (!items.length) {
      root.innerHTML = '<p class="empty">暂无新闻分类</p>';
      return;
    }
    root.innerHTML = items.map(function (c, index) {
      return '<div class="item-row" style="cursor:default">' +
        '<span class="category-order">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<div class="item-main">' +
        '<div class="item-title-row"><span class="item-title">' + escapeHtml(c.name) + '</span></div>' +
        '<div class="item-meta">显示顺序 ' + escapeHtml(String(c.sortOrder)) +
        '' + '</div></div>' +
        '<div class="item-actions">' +
        '<button type="button" class="btn-edit" data-edit-nc="' + escapeAttr(c.key) + '">编辑</button>' +
        '</div></div>';
    }).join('');
    root.querySelectorAll('[data-edit-nc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-edit-nc');
        var cat = state.newsCategories.find(function (c) { return c.key === key; });
        if (cat) editNewsCategory(cat);
      });
    });
  }
  function renderSolutionCatList() {
    var root = $('solution-cat-list');
    if (!root) return;
    var items = state.solutionCategories;
    if (!items.length) {
      root.innerHTML = '<p class="empty">暂无方案分类</p>';
      return;
    }
    root.innerHTML = items.map(function (c, index) {
      return '<div class="item-row" style="cursor:default">' +
        '<span class="category-order">' + String(index + 1).padStart(2, '0') + '</span>' +
        '<div class="item-main">' +
        '<div class="item-title-row"><span class="item-title">' + escapeHtml(c.name) + '</span></div>' +
        '<div class="item-meta">显示顺序 ' + escapeHtml(String(c.sortOrder)) +
        '' + '</div></div>' +
        '<div class="item-actions">' +
        '<button type="button" class="btn-edit" data-edit-sc="' + escapeAttr(c.key) + '">编辑</button>' +
        '</div></div>';
    }).join('');
    root.querySelectorAll('[data-edit-sc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-edit-sc');
        var cat = state.solutionCategories.find(function (c) { return c.key === key; });
        if (cat) editSolutionCategory(cat);
      });
    });
  }
  function nextCategorySort(items) {
    if (!items || !items.length) return 10;
    return Math.max.apply(null, items.map(function (item) {
      return Number(item.sortOrder) || 0;
    })) + 10;
  }

  function generatedCategoryKey(kind) {
    var prefix = kind === 'products' ? 'product-' : kind === 'solutions' ? 'solution-' : 'news-';
    return prefix + Date.now().toString(36).slice(-7);
  }

  function categoryKindMeta(kind) {
    if (kind === 'products') {
      return { label: '产品分类', hub: '产品中心', sync: '产品筛选与产品编辑表单', productLike: true, items: state.productCategories };
    }
    if (kind === 'solutions') {
      return { label: '方案分类', hub: '解决方案', sync: '方案筛选与方案编辑表单', productLike: true, items: state.solutionCategories };
    }
    return { label: '新闻分类', hub: '新闻中心', sync: '新闻筛选与新闻编辑表单', productLike: false, items: state.newsCategories };
  }

  function setCategoryFieldError(id, message) {
    var input = $(id);
    var error = $(id + '-error');
    if (input) input.classList.toggle('is-invalid', !!message);
    if (error) error.textContent = message || '';
  }

  function revealCategoryAdvanced() {
    var details = document.querySelector('#category-editor .category-advanced');
    if (details) details.open = true;
  }

  function openCategoryEditor(kind, cat) {
    var meta = categoryKindMeta(kind);
    var isNew = !cat;
    var items = meta.items || [];
    var key = cat ? cat.key : generatedCategoryKey(kind);
    var sortOrder = cat ? cat.sortOrder : nextCategorySort(items);
    openDrawer('category', (isNew ? '新增' : '编辑') + meta.label);
    $('category-editor').innerHTML =
      '<div class="category-editor-intro">' +
        '<span class="category-editor-context">' + meta.hub + ' · 分类管理</span>' +
        '<h4>' + (isNew ? '创建一个新的' : '修改当前') + meta.label + '</h4>' +
        '<p>这里只维护访客看得见的分类名称；系统关联和多语言标识会自动处理。</p>' +
      '</div>' +
      '<form id="category-form" novalidate data-category-kind="' + escapeAttr(kind) +
        '" data-category-mode="' + (isNew ? 'create' : 'edit') +
        '" data-category-key="' + escapeAttr(key) + '">' +
        '<div class="category-editor-card">' +
          '<div class="form-grid category-form-grid">' +
            '<div class="field full"><label for="category-name">分类名称 <span class="required-mark">*</span></label>' +
              '<input id="category-name" type="text" maxlength="40" value="' + escapeAttr(cat ? cat.name : '') + '">' +
              '<p class="field-help">这是运营人员和前台访客看到的名称。</p><p class="field-error" id="category-name-error"></p></div>' +
            '<div class="field full"><label for="category-sort">显示顺序</label>' +
              '<input id="category-sort" type="number" min="0" step="1" value="' + escapeAttr(String(sortOrder)) + '">' +
              '<p class="field-help">数字越小越靠前；后续可升级为拖动排序。</p><p class="field-error" id="category-sort-error"></p></div>' +
          '</div>' +
          '<div class="category-live-preview"><span>前台筛选预览</span><strong id="category-preview-name">' +
            escapeHtml(cat ? cat.name : '新分类') + '</strong></div>' +
        '</div>' +
        '<div class="category-editor-actions">' +
          '<div>' + (!isNew
            ? '<button type="button" class="btn btn-ghost btn-danger-text" id="delete-category">删除分类</button>'
            : '<span class="category-save-note">填写名称后即可创建，保存后系统会自动完成关联</span>') + '</div>' +
          '<div class="toolbar"><button type="button" class="btn btn-ghost" id="cancel-category">取消</button>' +
            '<button type="submit" class="btn btn-accent" id="save-category">' + (isNew ? '创建分类' : '保存修改') + '</button></div>' +
        '</div>' +
      '</form>';

    var nameInput = $('category-name');
    if (nameInput) {
      nameInput.addEventListener('input', function () {
        setCategoryFieldError('category-name', '');
        $('category-preview-name').textContent = nameInput.value.trim() || '新分类';
      });
      setTimeout(function () { nameInput.focus(); }, 0);
    }
    $('category-sort').addEventListener('input', function () {
      setCategoryFieldError('category-sort', '');
    });
    $('cancel-category').onclick = closeDrawer;
    $('category-form').addEventListener('submit', function (event) {
      event.preventDefault();
      saveCategoryEditor(kind, cat).catch(function (e) {
        toast(e.message || '保存失败，请稍后重试', true);
      });
    });
    if ($('delete-category')) {
      $('delete-category').onclick = function () {
        if (kind === 'products') deleteProductCategory(cat.key, cat.name, true);
        else if (kind === 'solutions') deleteSolutionCategoryUi(cat.key, cat.name, true);
        else deleteNewsCategoryUi(cat.key, cat.name, true);
      };
    }
  }
  async function saveCategoryEditor(kind, cat) {
    var meta = categoryKindMeta(kind);
    var form = $('category-form');
    if (form) {
      kind = form.getAttribute('data-category-kind') || kind;
      meta = categoryKindMeta(kind);
      if (form.getAttribute('data-category-mode') === 'create') cat = null;
      else if (!cat && form.getAttribute('data-category-key')) {
        cat = { key: form.getAttribute('data-category-key') };
      }
    }
    var isNew = !cat;
    var name = val('category-name').trim();
    var key = (form && form.getAttribute('data-category-key') || (cat && cat.key) || generatedCategoryKey(kind)).trim().toLowerCase();
    var sortRaw = val('category-sort').trim();
    var validKey = /^[a-z][a-z0-9_-]{0,31}$/.test(key);
    var validSort = /^\d+$/.test(sortRaw);
    setCategoryFieldError('category-name', name ? '' : '请填写分类名称');
    setCategoryFieldError('category-sort', validSort ? '' : '请输入大于或等于 0 的整数');
    if (!name || !validKey || !validSort) {
      if (!validKey) toast('系统未能生成分类标识，请关闭后重新创建', true);
      var firstInvalid = !name ? $('category-name') : $('category-sort');
      if (firstInvalid) firstInvalid.focus();
      return;
    }

    var payload = { key: key, name: name, sortOrder: Number(sortRaw) };
    if (meta.productLike) {
      payload.nameEn = cat ? (cat.nameEn || '') : '';
      payload.filterKeyEn = cat ? (cat.filterKeyEn || key) : key;
    }
    var saveButton = $('save-category');
    saveButton.disabled = true;
    saveButton.textContent = '正在保存…';
    try {
      var base = '/admin/categories/' + kind;
      await api(isNew ? base : base + '/' + encodeURIComponent(cat.key), {
        method: isNew ? 'POST' : 'PUT',
        body: JSON.stringify(payload),
      });
      await loadCategories();
      closeDrawer();
      toast(meta.label + (isNew ? '已创建' : '已保存'));
    } catch (err) {
      if (err.message === 'already_exists' || err.message === 'invalid_category_key') {
        toast('系统分类标识冲突，请关闭窗口后重新创建', true);
      } else if (err.message === 'missing_category_name') {
        setCategoryFieldError('category-name', '请填写分类名称');
      } else if (err.message === 'not_found') {
        toast(isNew ? '创建失败：后台接口未就绪，请重启 server 后重试' : '分类不存在或已被删除，请刷新列表后重试', true);
      } else {
        toast(err.message || '保存失败，请稍后重试', true);
      }
      saveButton.disabled = false;
      saveButton.textContent = isNew ? '创建分类' : '保存修改';
    }
  }
  function editProductCategory(cat) {
    openCategoryEditor('products', cat);
  }

  function editSolutionCategory(cat) {
    openCategoryEditor('solutions', cat);
  }

  function editNewsCategory(cat) {
    openCategoryEditor('news', cat);
  }
  function deleteProductCategory(key, name, closeAfter) {
    if (!confirm('确定删除产品分类「' + (name || key) + '」吗？正在被产品使用的分类不能删除。')) return;
    api('/admin/categories/products/' + encodeURIComponent(key), { method: 'DELETE' })
      .then(function () {
        if (closeAfter) closeDrawer();
        toast('产品分类已删除');
        return loadCategories();
      })
      .catch(function (e) {
        toast(e.message === 'category_in_use' ? '仍有产品在使用这个分类，暂时不能删除' : e.message, true);
      });
  }

  function deleteNewsCategoryUi(key, name, closeAfter) {
    if (!confirm('确定删除新闻分类「' + (name || key) + '」吗？正在被新闻使用的分类不能删除。')) return;
    api('/admin/categories/news/' + encodeURIComponent(key), { method: 'DELETE' })
      .then(function () {
        if (closeAfter) closeDrawer();
        toast('新闻分类已删除');
        return loadCategories();
      })
      .catch(function (e) {
        toast(e.message === 'category_in_use' ? '仍有新闻在使用这个分类，暂时不能删除' : e.message, true);
      });
  }

  function deleteSolutionCategoryUi(key, name, closeAfter) {
    if (!confirm('确定删除方案分类「' + (name || key) + '」吗？正在被方案使用的分类不能删除。')) return;
    api('/admin/categories/solutions/' + encodeURIComponent(key), { method: 'DELETE' })
      .then(function () {
        if (closeAfter) closeDrawer();
        toast('方案分类已删除');
        return loadCategories();
      })
      .catch(function (e) {
        toast(e.message === 'category_in_use' ? '仍有方案在使用这个分类，暂时不能删除' : e.message, true);
      });
  }
  async function openProduct(id) {
    state.isNewProduct = false;
    state.selectedProductId = id;
    renderProductTable();
    await ensureCategoriesLoaded();
    var item = await api('/admin/products/' + encodeURIComponent(id));
    fillProductForm(item, false);
  }

  function blankProduct() {
    return {
      name: '', model: '', category: '', filterKey: '', image: '', specs: [], summary: '',
      contentHtml: '', published: false, showInList: true,
      sortOrder: 0, filterKeyEn: '',
    };
  }

  function fillProductForm(item, isNew) {
    var title = item.name || '未命名产品';
    var context = isNew ? '填写产品信息后保存' : (item.model || item.category || '产品内容');
    openDrawer('product', title, {
      eyebrow: isNew ? '新增产品' : '编辑产品',
      context: context,
      sections: [
        { key: 'basic', label: '基本信息' },
        { key: 'content', label: '展示内容' },
        { key: 'publish', label: '发布设置' },
      ],
    });

    var previewHref = !isNew && item.id != null
      ? '/product-detail.html?id=' + encodeURIComponent(item.id)
      : '';
    var basicHtml =
      '<div class="form-grid">' +
      field('name', '产品名称', item.name, 'full') +
      field('model', '型号', item.model) +
      productCategorySelect(item) +
      field('summary', '一句话介绍', item.summary, 'full', 'textarea') +
      '</div>';
    var contentHtml =
      '<div class="form-grid">' +
      imageField('image', '封面图', item.image) +
      field('specs', '规格亮点（每行一条）', (item.specs || []).join('\n'), 'full', 'textarea') +
      richTextField('contentHtml', '产品详情', item.contentHtml, '用工具栏排版即可，不必手写代码') +
      '</div>';
    var publishHtml =
      '<div class="form-grid catalog-publish-grid">' +
      publishedCheck('p-published', !!item.published) +
      '<div class="field full"><p class="field-help">新建默认未发布；取消发布后，官网将不再展示该产品。</p></div>' +
      '<div class="field full"><label class="check"><input type="checkbox" id="p-showInList"' +
      (item.showInList !== false ? ' checked' : '') + '> 在产品中心列表显示</label></div>' +
      field('sortOrder', '列表排序（数字越小越靠前）', item.sortOrder != null ? item.sortOrder : 0, 'full') +
      '</div>' +
      catalogActionZone('product', '产品', item, isNew, previewHref);

    $('product-editor').innerHTML =
      '<div class="catalog-editor-content">' +
      (isNew ? '<p class="catalog-create-tip">填写基本信息后即可先保存，详情内容可以稍后继续完善。</p>' : '') +
      editorSection('basic', '基本信息', '对应前台产品卡片与详情页首屏', basicHtml) +
      editorSection('content', '展示内容', '封面、规格和产品详情', contentHtml) +
      editorSection('publish', '发布设置', '控制官网展示状态与列表顺序', publishHtml) +
      '</div>' +
      catalogSaveBar('product', '产品', isNew);

    bindImageFields($('product-editor'));
    initRichEditors(['f-contentHtml']);
    bindCatalogEditorState('product-editor', 'product');
    bindDrawerSectionNav('product-editor');
    $('save-product').onclick = function () {
      runCatalogSave('product', '产品', saveProduct);
    };
    $('cancel-product').onclick = closeDrawer;

    if (!isNew) {
      $('reload-product').onclick = function () { openProduct(item.id); };
      if ($('unpublish-product')) {
        $('unpublish-product').onclick = function () {
          unpublishCatalog('products', item.id).catch(function (e) { toast(e.message, true); });
        };
      }
      $('delete-product').onclick = function () { deleteCatalog('products', item.id, item.name); };
    }
  }
  async function saveProduct() {
    var name = val('f-name').trim();
    if (!name) {
      toast('请填写产品名称', true);
      return false;
    }
    var categoryKey = val('f-categoryKey');
    if (!categoryKey) {
      toast('请选择产品分类', true);
      return false;
    }
    var body = {
      name: name, model: val('f-model'), categoryKey: categoryKey, image: val('f-image'),
      specs: val('f-specs').split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      summary: val('f-summary'), contentHtml: getRichHtml('contentHtml'),
      published: $('p-published').checked,
      showInList: $('p-showInList').checked,
      sortOrder: Number(val('f-sortOrder')) || 0,
    };
    if (state.isNewProduct) {
      var created = await api('/admin/products', { method: 'POST', body: JSON.stringify(body) });
      state.isNewProduct = false;
      state.selectedProductId = created.id;
      toast('产品已创建');
      await loadProducts();
      await openProduct(created.id);
      return true;
    }
    body.id = String(state.selectedProductId);
    await api('/admin/products/' + encodeURIComponent(state.selectedProductId), {
      method: 'PUT', body: JSON.stringify(body),
    });
    toast('产品已保存');
    await loadProducts();
    return true;
  }

  async function createProduct() {
    state.isNewProduct = true;
    state.selectedProductId = null;
    renderProductTable();
    await ensureCategoriesLoaded();
    fillProductForm(blankProduct(), true);
  }

  /* News */
  async function loadNews() {
    state.news = (await api('/admin/news')).items || [];
    renderNewsTable();
    updateHubCount('news');
  }

  function renderNewsTable() {
    var list = $('news-list');
    if (!list) return;
    var rows = filterItems(state.news, $('news-search').value, ['id', 'title', 'category']);
    updateListStatusCounts('news', rows);
    rows = applyListStatusFilter(rows, state.listStatus.news || 'all');
    var pageInfo = paginateRows(rows, state.listPages.news, CATALOG_PAGE_SIZE);
    if (pageInfo.page !== state.listPages.news) state.listPages.news = pageInfo.page;
    list.innerHTML = pageInfo.rows.map(function (n) {
      var meta = [n.category, n.date].filter(Boolean).join(' · ');
      return itemCardHtml({
        id: n.id,
        title: n.title,
        image: n.cover,
        published: n.published,
        meta: meta,
        badgeHtml: n.homeFeatured ? '<span class="home-slot-badge">首页精选</span>' : '',
        active: String(n.id) === String(state.selectedNewsId),
      });
    }).join('') || '<p class="empty">没有匹配的新闻</p>';
    bindItemList(list, openNews);
    renderCatalogPagination('news', pageInfo);
  }

  async function openNews(id) {
    state.isNewNews = false;
    state.selectedNewsId = id;
    renderNewsTable();
    await ensureCategoriesLoaded();
    var item = await api('/admin/news/' + encodeURIComponent(id));
    fillNewsForm(item, false);
  }

  function blankNews() {
    var d = new Date();
    var date = d.getFullYear() + '.' +
      String(d.getMonth() + 1).padStart(2, '0') + '.' +
      String(d.getDate()).padStart(2, '0');
    return {
      title: '', category: '', date: date, cover: '',
      contentHtml: '', published: false, sortOrder: 0, homeFeatured: false,
    };
  }

  function fillNewsForm(item, isNew) {
    var title = item.title || '未命名新闻';
    var context = isNew ? '填写新闻内容后保存' : (item.date || item.category || '新闻内容');
    openDrawer('news', title, {
      eyebrow: isNew ? '新增新闻' : '编辑新闻',
      context: context,
      sections: [
        { key: 'basic', label: '基本信息' },
        { key: 'content', label: '正文内容' },
        { key: 'publish', label: '发布设置' },
      ],
    });

    var previewHref = !isNew && item.id != null
      ? '/news-detail.html?id=' + encodeURIComponent(item.id)
      : '';
    var basicHtml =
      '<div class="form-grid">' +
      field('title', '新闻标题', item.title, 'full') +
      newsCategorySelect(item) +
      field('date', '发布日期', item.date) +
      '</div>';
    var contentHtml =
      '<div class="form-grid">' +
      imageField('cover', '封面图', item.cover) +
      richTextField('contentHtml', '新闻正文', item.contentHtml, '用工具栏排版即可，不必手写代码') +
      '</div>';
    var publishHtml =
      '<div class="form-grid catalog-publish-grid">' +
      publishedCheck('n-published', !!item.published) +
      '<div class="field full check-row"><input type="checkbox" id="n-home-featured"' +
      (item.homeFeatured ? ' checked' : '') + '>' +
      '<label for="n-home-featured" style="text-transform:none;letter-spacing:0;font-size:14px;color:var(--txam-dark)">在首页展示为精选新闻</label></div>' +
      '<div class="field full"><p class="field-help">首页精选需要始终保留内容；取消精选或下架时，可能需要指定另一条已发布新闻替代。</p></div>' +
      field('sortOrder', '列表排序（数字越小越靠前）', item.sortOrder != null ? item.sortOrder : 0, 'full') +
      '</div>' +
      catalogActionZone('news', '新闻', item, isNew, previewHref);

    $('news-editor').innerHTML =
      '<div class="catalog-editor-content">' +
      (isNew ? '<p class="catalog-create-tip">先填写标题与分类即可保存，正文和发布设置可以随后继续完善。</p>' : '') +
      editorSection('basic', '基本信息', '对应新闻列表卡片与详情页首屏', basicHtml) +
      editorSection('content', '正文内容', '新闻封面与正文排版', contentHtml) +
      editorSection('publish', '发布设置', '控制官网状态、首页精选与列表顺序', publishHtml) +
      '</div>' +
      catalogSaveBar('news', '新闻', isNew);

    bindImageFields($('news-editor'));
    initRichEditors(['f-contentHtml']);
    bindCatalogEditorState('news-editor', 'news');
    bindDrawerSectionNav('news-editor');
    $('save-news').onclick = function () {
      runCatalogSave('news', '新闻', saveNews);
    };
    $('cancel-news').onclick = closeDrawer;

    if (!isNew) {
      $('reload-news').onclick = function () { openNews(item.id); };
      if ($('unpublish-news')) {
        $('unpublish-news').onclick = function () {
          unpublishCatalog('news', item.id).catch(function (e) { toast(e.message, true); });
        };
      }
      $('delete-news').onclick = function () { deleteCatalog('news', item.id, item.title); };
    }
  }
  async function saveNews() {
    var title = val('f-title').trim();
    if (!title) {
      toast('请填写新闻标题', true);
      return false;
    }
    var category = val('f-category');
    if (!category) {
      toast('请选择新闻分类', true);
      return false;
    }
    var body = {
      title: title, category: category, date: val('f-date'), cover: val('f-cover'),
      contentHtml: getRichHtml('contentHtml'), published: $('n-published').checked,
      sortOrder: Number(val('f-sortOrder')) || 0,
      homeFeatured: $('n-home-featured').checked,
    };
    if (state.isNewNews) {
      var created = await saveWithSlotRetry('/admin/news', body, 'POST');
      state.isNewNews = false;
      state.selectedNewsId = created.id;
      toast('新闻已创建');
      await loadNews();
      await openNews(created.id);
      return true;
    }
    body.id = String(state.selectedNewsId);
    await saveWithSlotRetry('/admin/news/' + encodeURIComponent(state.selectedNewsId), body, 'PUT');
    toast('新闻已保存');
    await loadNews();
    return true;
  }

  async function createNews() {
    state.isNewNews = true;
    state.selectedNewsId = null;
    renderNewsTable();
    await ensureCategoriesLoaded();
    fillNewsForm(blankNews(), true);
  }

  /* Solutions */
  async function loadSolutions() {
    state.solutions = (await api('/admin/solutions')).items || [];
    renderSolutionTable();
    updateHubCount('solutions');
  }

  function renderSolutionTable() {
    var list = $('solution-list');
    if (!list) return;
    var rows = filterItems(state.solutions, $('solution-search').value, ['id', 'name', 'category']);
    updateListStatusCounts('solutions', rows);
    rows = applyListStatusFilter(rows, state.listStatus.solutions || 'all');
    var pageInfo = paginateRows(rows, state.listPages.solutions, CATALOG_PAGE_SIZE);
    if (pageInfo.page !== state.listPages.solutions) state.listPages.solutions = pageInfo.page;
    list.innerHTML = pageInfo.rows.map(function (s) {
      var slotLabel = s.homeSlot === 'hero' ? '标杆方案' : s.homeSlot === 'category' ? '精选方案' : '';
      var meta = [s.category].filter(Boolean).join(' · ');
      return itemCardHtml({
        id: s.id,
        title: s.name,
        image: s.image,
        published: s.published,
        meta: meta,
        badgeHtml: slotLabel ? '<span class="home-slot-badge">' + escapeHtml(slotLabel) + '</span>' : '',
        active: String(s.id) === String(state.selectedSolutionId),
      });
    }).join('') || '<p class="empty">没有匹配的方案</p>';
    bindItemList(list, openSolution);
    renderCatalogPagination('solutions', pageInfo);
  }

  async function openSolution(id) {
    state.isNewSolution = false;
    state.selectedSolutionId = id;
    renderSolutionTable();
    await ensureCategoriesLoaded();
    var item = await api('/admin/solutions/' + encodeURIComponent(id));
    fillSolutionForm(item, false);
  }

  function blankSolution() {
    return {
      name: '', category: '', filterKey: '', image: '', specs: [], summary: '',
      contentHtml: '', published: false, painPoints: [], process: [], slug: '', sortOrder: 0,
      homeSlot: '',
    };
  }

  function solutionSlugSelect(item) {
    var slugOpts = ['tv-display','refrigerator','packaging','washer','capacitor','ac','microwave','coffee','tablet','headlight','robot'];
    var slugLabels = {
      'tv-display': 'TV / 商显', refrigerator: '冰箱', packaging: '包装', washer: '洗衣机',
      capacitor: '电容', ac: '空调', microwave: '微波炉', coffee: '咖啡机',
      tablet: '平板', headlight: '车灯', robot: '机器人',
    };
    return '<div class="field"><label>详情页面类型</label><select id="f-slug">' +
      '<option value="">通用方案详情页</option>' +
      slugOpts.map(function (s) {
        return '<option value="' + s + '"' + (item.slug === s ? ' selected' : '') + '>' +
          escapeHtml(slugLabels[s] || s) + '</option>';
      }).join('') +
      '</select><p class="field-help">按业务名称选择即可，系统会自动关联正确页面。</p></div>';
  }
  function solutionHomeSlotBlock(item) {
    var cur = item.homeSlot || '';
    function opt(value, title, desc) {
      var checked = cur === value ? ' checked' : '';
      return '<label class="slot-choice' + (cur === value ? ' is-selected' : '') + '">' +
        '<input type="radio" name="homeSlot" value="' + escapeAttr(value) + '"' + checked + '>' +
        '<span class="slot-choice-body"><strong>' + escapeHtml(title) + '</strong>' +
        '<span class="help">' + escapeHtml(desc) + '</span></span></label>';
    }
    return '<div class="home-slot-card">' +
      '<h3 class="card-title">首页展示位置（可选）</h3>' +
      '<p class="field-help">新建内容默认不在首页展示，只出现在对应页面或内容列表。需要时再选择下面其中一个推荐位置（不可同时选择）。首页标杆与精选位置需要始终保留内容，取消或下架时须指定替代内容。</p>' +
      '<div class="slot-choice-list" id="solution-home-slot">' +
      opt('hero', '标杆方案', '首页首屏大图，全站 1 个') +
      opt('category', '精选方案', '首页「三大核心类目」方案卡，最多 2 个（另有固定单元设备卡）') +
      '</div>' +
      (cur
        ? '<button type="button" class="btn btn-ghost btn-sm" id="clear-home-slot" style="margin-top:8px">取消首页展示</button>'
        : '') +
      publishedCheck('s-published', !!item.published) +
      '</div>';
  }

  function fillSolutionForm(item, isNew) {
    var title = item.name || '未命名方案';
    var context = isNew ? '填写方案内容后保存 · 默认不在首页展示' : (item.category || '方案内容');
    openDrawer('solution', title, {
      eyebrow: isNew ? '新增方案' : '编辑方案',
      context: context,
      sections: [
        { key: 'basic', label: '基本信息' },
        { key: 'content', label: '方案内容' },
        { key: 'publish', label: '发布设置' },
      ],
    });

    var previewHref = !isNew && item.slug ? '/' + encodeURIComponent(item.slug) + '-solution.html' : '';
    var basicHtml =
      '<div class="form-grid">' +
      field('name', '方案名称', item.name, 'full') +
      solutionCategorySelect(item) +
      solutionSlugSelect(item) +
      field('summary', '一句话介绍', item.summary, 'full', 'textarea') +
      '</div>';
    var contentHtml =
      '<div class="form-grid">' +
      imageField('image', '封面图', item.image) +
      field('specs', '亮点标签（每行一条）', (item.specs || []).join('\n'), 'full', 'textarea') +
      richTextField('contentHtml', '方案详情', item.contentHtml, '用工具栏排版即可，不必手写代码') +
      '</div>' +
      '<div class="catalog-editor-subsection"><div class="catalog-editor-subhead"><h5>客户痛点</h5>' +
      '<p>用普通文字填写，例如“大尺寸装配难”</p></div>' +
      pairRowsHtml('pain', item.painPoints || [], '痛点标题', '痛点说明') + '</div>' +
      '<div class="catalog-editor-subsection"><div class="catalog-editor-subhead"><h5>工艺流程</h5>' +
      '<p>按实际执行顺序写清每一步“做什么”</p></div>' +
      processRowsHtml(item.process || []) + '</div>';
    var publishHtml =
      solutionHomeSlotBlock(item) +
      '<div class="form-grid catalog-publish-grid">' +
      field('sortOrder', '列表排序（数字越小越靠前）', item.sortOrder != null ? item.sortOrder : 0, 'full') +
      '</div>' +
      catalogActionZone('solution', '方案', item, isNew, previewHref);

    $('solution-editor').innerHTML =
      '<div class="catalog-editor-content">' +
      (isNew ? '<p class="catalog-create-tip">先保存基本信息，再完善痛点、流程和首页展示位置。</p>' : '') +
      editorSection('basic', '基本信息', '对应方案列表卡片与详情页首屏', basicHtml) +
      editorSection('content', '方案内容', '封面、亮点、详情、客户痛点与工艺流程', contentHtml) +
      editorSection('publish', '发布设置', '控制官网状态、首页推荐与列表顺序', publishHtml) +
      '</div>' +
      catalogSaveBar('solution', '方案', isNew);

    bindImageFields($('solution-editor'));
    bindPairRepeater('pain');
    bindProcessRepeater();
    initRichEditors(['f-contentHtml']);
    bindCatalogEditorState('solution-editor', 'solution');
    bindDrawerSectionNav('solution-editor');

    var slotRoot = $('solution-home-slot');
    if (slotRoot) {
      slotRoot.querySelectorAll('input[name="homeSlot"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          slotRoot.querySelectorAll('.slot-choice').forEach(function (lab) {
            lab.classList.toggle('is-selected', lab.querySelector('input').checked);
          });
        });
      });
    }
    if ($('clear-home-slot')) {
      $('clear-home-slot').onclick = function () {
        slotRoot.querySelectorAll('input[name="homeSlot"]').forEach(function (r) { r.checked = false; });
        slotRoot.querySelectorAll('.slot-choice').forEach(function (lab) { lab.classList.remove('is-selected'); });
        $('clear-home-slot').remove();
      };
    }

    $('save-solution').onclick = function () {
      runCatalogSave('solution', '方案', saveSolution);
    };
    $('cancel-solution').onclick = closeDrawer;

    if (!isNew) {
      $('reload-solution').onclick = function () { openSolution(item.id); };
      if ($('unpublish-solution')) {
        $('unpublish-solution').onclick = function () {
          unpublishCatalog('solutions', item.id).catch(function (e) { toast(e.message, true); });
        };
      }
      $('delete-solution').onclick = function () { deleteCatalog('solutions', item.id, item.name); };
    }
  }
  async function saveSolution() {
    var name = val('f-name').trim();
    if (!name) {
      toast('请填写方案名称', true);
      return false;
    }
    var categoryKey = val('f-categoryKey');
    if (!categoryKey) {
      toast('请选择方案分类', true);
      return false;
    }
    var slotEl = document.querySelector('#solution-home-slot input[name="homeSlot"]:checked');
    var body = {
      name: name, categoryKey: categoryKey, image: val('f-image'),
      slug: val('f-slug'),
      sortOrder: Number(val('f-sortOrder')) || 0,
      specs: val('f-specs').split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      summary: val('f-summary'), contentHtml: getRichHtml('contentHtml'),
      painPoints: collectPairRepeater('pain'),
      process: collectProcessRepeater(),
      published: $('s-published').checked,
      homeSlot: slotEl ? (slotEl.value || '') : '',
    };
    if (state.isNewSolution) {
      var created = await saveWithSlotRetry('/admin/solutions', body, 'POST');
      state.isNewSolution = false;
      state.selectedSolutionId = created.id;
      toast('方案已创建');
      await loadSolutions();
      await openSolution(created.id);
      return true;
    }
    body.id = String(state.selectedSolutionId);
    await saveWithSlotRetry('/admin/solutions/' + encodeURIComponent(state.selectedSolutionId), body, 'PUT');
    toast('方案已保存');
    await loadSolutions();
    return true;
  }

  function createSolution() {
    state.isNewSolution = true;
    state.selectedSolutionId = null;
    renderSolutionTable();
    ensureCategoriesLoaded().then(function () {
      fillSolutionForm(blankSolution(), true);
    }).catch(function (e) { toast(e.message, true); });
  }

  async function deleteCatalog(kind, id, title) {
    var kindLabels = { products: '产品', solutions: '方案', news: '新闻' };
    var subject = title ? '“' + title + '”' : (kindLabels[kind] || '该内容');
    if (!confirm('确认删除' + subject + '？此操作不可撤销。')) return;
    var path = '/admin/' + kind + '/' + encodeURIComponent(id);
    try {
      await api(path, { method: 'DELETE' });
    } catch (err) {
      if (err.status === 409 && err.data && err.data.error === 'unpublish_needs_replace') {
        var replaceId = await promptSlotReplace(err.data);
        if (!replaceId) throw new Error('已取消');
        await api(path + '?replaceId=' + encodeURIComponent(replaceId), { method: 'DELETE' });
      } else {
        throw err;
      }
    }
    toast('已删除' + subject);
    closeDrawer();
    if (kind === 'products') {
      state.selectedProductId = null;
      $('product-editor').innerHTML = '<p class="empty">选择产品进行编辑</p>';
      await loadProducts();
    } else if (kind === 'news') {
      state.selectedNewsId = null;
      $('news-editor').innerHTML = '<p class="empty">选择新闻进行编辑</p>';
      await loadNews();
    } else {
      state.selectedSolutionId = null;
      $('solution-editor').innerHTML = '<p class="empty">选择方案进行编辑</p>';
      await loadSolutions();
    }
  }

  /* Pages + Site — structured editors (phases 1–3) */

  function bindGenericRepeater(rootId, blankHtml) {
    var root = $(rootId);
    if (!root || root._bound) return;
    root._bound = true;
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (t.classList.contains('rep-add-generic')) {
        var row = document.createElement('div');
        row.className = 'repeater-row';
        row.innerHTML = blankHtml;
        root.insertBefore(row, t);
        bindRepeaterMedia(row);
      }
      /* remove handled by bindLeafRepeaterRemove */
    });
  }

  function bindRepeaterMedia(scope) {
    (scope || document).querySelectorAll('[data-pick-inline]').forEach(function (btn) {
      if (btn._bound) return;
      btn._bound = true;
      btn.addEventListener('click', function () {
        var input = btn.closest('.field').querySelector('input');
        openMediaPicker(null, function (path) {
          if (input) {
            input.value = path;
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }
        });
      });
    });
  }

  function seoBlock(page) {
    return cardBlock('搜索设置',
      field('seo-title', '浏览器标题', (page.seo || {}).title, 'full') +
      field('seo-desc', '搜索摘要', (page.seo || {}).description, 'full', 'textarea') +
      imageField('seo-image', '分享封面图片', (page.seo || {}).image || ''));
  }

  function collectSeo() {
    return { title: val('f-seo-title'), description: val('f-seo-desc'), image: val('f-seo-image') };
  }

  function collectStatsFrom(rootId, prevItems) {
    var root = $(rootId);
    if (!root) return [];
    prevItems = prevItems || [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row, i) {
      var prev = prevItems[rowSourceIndex(row, i)] || {};
      return Object.assign({}, prev, {
        value: (row.querySelector('.st-value') || {}).value || '',
        unit: (row.querySelector('.st-unit') || {}).value || '',
        label: (row.querySelector('.st-label') || {}).value || '',
      });
    }).filter(function (x) { return x.value || x.label; });
  }
  function textFromHtml(html) {
    var normalized = String(html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n');
    var holder = document.createElement('div');
    holder.innerHTML = normalized;
    return (holder.textContent || holder.innerText || '').replace(/\u00a0/g, ' ').trim();
  }

  function textToHtml(text) {
    return escapeHtml(String(text || '').trim()).replace(/\r?\n/g, '<br>');
  }

  function rowSourceIndex(row, fallback) {
    var raw = row && row.getAttribute('data-source-index');
    var parsed = raw == null || raw === '' ? NaN : Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
  }

  var PAGE_LINK_CHOICES = [
    { value: 'products.html', label: '产品中心' },
    { value: 'solutions.html', label: '解决方案' },
    { value: 'about.html', label: '关于我们' },
    { value: 'news.html', label: '新闻中心' },
    { value: 'contact.html', label: '联系我们' },
  ];

  function pageLinkSelect(name, label, value) {
    var current = value || '';
    var choices = PAGE_LINK_CHOICES.slice();
    if (current && !choices.some(function (item) { return item.value === current; })) {
      choices.push({ value: current, label: '保留当前跳转' });
    }
    return '<div class="field"><label for="f-' + name + '">' + escapeHtml(label) + '</label>' +
      '<select id="f-' + name + '">' +
      choices.map(function (item) {
        return '<option value="' + escapeAttr(item.value) + '"' +
          (item.value === current ? ' selected' : '') + '>' + escapeHtml(item.label) + '</option>';
      }).join('') + '</select>' +
      '<p class="field-help">只需选择要打开的前台页面，无需填写链接。</p></div>';
  }
  /* ——— Home service steps / contact channels / about repeaters ——— */
  var HOME_STEP_BLANK =
    '<div class="form-grid">' +
    '<div class="field full"><label>步骤标题</label><input class="hs-title" type="text"></div>' +
    '<div class="field full"><label>步骤要点（每行一条）</label><textarea class="hs-items"></textarea></div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';
  var CHANNEL_BLANK =
    '<div class="form-grid">' +
    '<div class="field full"><label>对外名称</label><input class="ch-title" type="text"></div>' +
    '<div class="field full"><label>号码或邮箱</label><input class="ch-value" type="text"></div>' +
    '<div class="field full"><label>联系人或辅助说明</label><input class="ch-hint" type="text"></div></div>';
  var PILLAR_BLANK =
    '<div class="form-grid"><div class="field full"><label>标题</label><input class="pl-title" type="text"></div>' +
    '<div class="field full"><label>说明</label><textarea class="pl-body"></textarea></div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';

  var CULTURE_PILLAR_BLANK =
    '<div class="form-grid"><div class="field full"><label>标题</label><input class="cp-title" type="text"></div>' +
    '<div class="field full"><label>正文</label><textarea class="cp-body"></textarea>' +
    '<p class="field-help">直接输入文字和换行，无需填写 HTML。</p></div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';
  var CLIENT_BLANK =
    '<div class="form-grid">' +
    '<div class="field full image-field"><label>Logo</label><div class="image-field-row">' +
    '<input class="cl-image" type="text"><button type="button" class="btn btn-ghost btn-sm" data-pick-inline>从媒体库选图</button></div></div>' +
    '<div class="field full"><label>客户名称</label><input class="cl-alt" type="text"></div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';
  var CAROUSEL_SLIDE_BLANK =
    '<div class="form-grid">' +
    '<div class="field full image-field"><label>图片</label><div class="image-field-row">' +
    '<input class="cs-image" type="text"><button type="button" class="btn btn-ghost btn-sm" data-pick-inline>从媒体库选图</button></div></div>' +
    '<div class="field"><label>标题</label><input class="cs-title" type="text"></div>' +
    '<div class="field"><label>上方标签</label><input class="cs-tag" type="text"></div>' +
    '<div class="field full"><label>描述</label><input class="cs-desc" type="text"></div>' +
    '<div class="field"><label>切换标签</label><input class="cs-dot" type="text"></div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';
  var TIMELINE_BLANK =
    '<div class="form-grid">' +
    '<div class="field"><label>年份</label><input class="tl-year" type="text"></div>' +
    '<div class="field full"><label>重点一句（可选）</label><textarea class="tl-lead"></textarea></div>' +
    '<div class="field full"><label>详细内容</label><textarea class="tl-body"></textarea></div>' +
    '<div class="field full"><label>手机端精简内容（可选）</label><textarea class="tl-mobile"></textarea>' +
    '<p class="field-help">留空时手机端自动使用详细内容。</p></div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';
  var CRED_ITEM_BLANK =
    '<div class="form-grid">' +
    '<div class="field full image-field"><label>图片</label><div class="image-field-row">' +
    '<input class="ci-image" type="text"><button type="button" class="btn btn-ghost btn-sm" data-pick-inline>从媒体库选图</button></div></div>' +
    '</div><button type="button" class="btn btn-ghost btn-sm rep-remove-item">删除图片</button>';
  function credGroupRowHtml(g, sourceIndex) {
    g = g || { title: '', items: [] };
    var items = g.items && g.items.length ? g.items : [{ image: '', imageAlt: '' }];
    var sourceAttr = Number.isInteger(sourceIndex) ? ' data-source-index="' + sourceIndex + '"' : '';
    return '<div class="repeater-row cred-group"' + sourceAttr + '><div class="form-grid">' +
      '<div class="field full"><label>分组标题</label><input class="cg-title" type="text" value="' + escapeAttr(g.title || '') + '"></div>' +
      '</div><p class="field-help">展示方式和滚动速度由前端设计自动处理。</p>' +
      '<h4 class="sub-title">图片</h4><div class="repeater nested-rep">' +
      items.map(function (it, itemIndex) {
        return '<div class="repeater-row" data-source-index="' + itemIndex + '">' +
          '<div class="form-grid">' +
          '<div class="field full image-field"><label>图片</label><div class="image-field-row">' +
          '<input class="ci-image" type="text" value="' + escapeAttr(it.image || '') + '">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-pick-inline>从媒体库选图</button></div></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove-item">删除图片</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-cred-item">＋ 添加图片</button></div>' +
      '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除分组</button></div>';
  }
  function homeServiceStepsHtml(steps) {
    steps = steps && steps.length ? steps : [{ title: '', items: [] }];
    return '<div class="repeater" id="rep-home-steps">' +
      steps.map(function (s, i) {
        return '<div class="repeater-row" data-source-index="' + i + '">' +
          '<div class="repeater-row-head"><strong>第 ' + (i + 1) + ' 步</strong>' +
          '<span class="help">序号和展示样式由系统自动处理</span></div><div class="form-grid">' +
          '<div class="field full"><label>步骤标题</label><input class="hs-title" type="text" value="' + escapeAttr(s.title || '') + '"></div>' +
          '<div class="field full"><label>步骤要点（每行一条）</label><textarea class="hs-items">' + escapeHtml((s.items || []).join('\n')) + '</textarea></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-generic">＋ 添加步骤</button></div>';
  }
  function collectHomeServiceSteps() {
    var root = $('rep-home-steps');
    if (!root) return [];
    var rows = Array.prototype.slice.call(root.querySelectorAll(':scope > .repeater-row'));
    return rows.map(function (row, i) {
      return {
        badge: String(i + 1).padStart(2, '0'),
        badgeStyle: i === 0 ? 'start' : (i === rows.length - 1 ? 'accent' : 'mid'),
        title: (row.querySelector('.hs-title') || {}).value || '',
        items: ((row.querySelector('.hs-items') || {}).value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      };
    }).filter(function (x) { return x.title || x.items.length; });
  }
  function channelRowsHtml(items) {
    items = items && items.length ? items : [
      { type: 'phone', title: '国内业务专线', value: '', hint: '' },
      { type: 'whatsapp', title: 'WhatsApp', value: '', hint: '' },
      { type: 'email', title: '官方电子邮箱', value: '', hint: '' },
    ];
    function meta(type) {
      if (type === 'email') return { title: '官方邮箱', value: '邮箱地址' };
      if (type === 'whatsapp') return { title: 'WhatsApp', value: 'WhatsApp 号码' };
      return { title: '国内业务电话', value: '电话号码' };
    }
    return '<div class="repeater contact-channel-list" id="rep-channels">' +
      items.map(function (c, i) {
        var copy = meta(c.type);
        return '<div class="repeater-row contact-channel-card" data-source-index="' + i + '">' +
          '<div class="repeater-row-head"><strong>' + escapeHtml(copy.title) + '</strong>' +
          '<span class="help">图标、链接和展示样式由系统处理</span></div><div class="form-grid">' +
          '<div class="field full"><label>对外名称</label><input class="ch-title" type="text" value="' + escapeAttr(c.title || '') + '"></div>' +
          '<div class="field full"><label>' + escapeHtml(copy.value) + '</label><input class="ch-value" type="text" value="' + escapeAttr(c.value || '') + '"></div>' +
          '<div class="field full"><label>联系人或辅助说明</label><input class="ch-hint" type="text" value="' + escapeAttr(c.hint || '') + '"></div>' +
          '</div></div>';
      }).join('') + '</div>';
  }
  function collectChannels(prevItems) {
    var root = $('rep-channels');
    if (!root) return [];
    prevItems = prevItems || [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row, i) {
      var prev = prevItems[rowSourceIndex(row, i)] || {};
      var type = prev.type || (i === 1 ? 'whatsapp' : (i === 2 ? 'email' : 'phone'));
      var value = (row.querySelector('.ch-value') || {}).value || '';
      var href = prev.href || '';
      if (type === 'email') href = 'mailto:' + value.trim();
      else if (type === 'whatsapp') href = 'https://wa.me/' + value.replace(/\D/g, '');
      else if (type === 'phone') href = 'tel:' + value.replace(/[^\d+]/g, '');
      var defaults = type === 'whatsapp'
        ? { icon: '💬', target: '_blank', colSpan: 1, hover: 'whatsapp' }
        : type === 'email'
          ? { icon: '📧', target: '_self', colSpan: 2, hover: 'dark', cta: '点击发送邮件 →' }
          : { icon: '📞', target: '_self', colSpan: 1, hover: 'dark' };
      return Object.assign({}, defaults, prev, {
        type: type,
        href: href,
        title: (row.querySelector('.ch-title') || {}).value || '',
        value: value,
        hint: (row.querySelector('.ch-hint') || {}).value || '',
      });
    }).filter(function (x) { return x.title || x.value; });
  }
  function pillarsRowsHtml(items) {
    items = items && items.length ? items : [{ title: '', body: '' }];
    return '<div class="repeater" id="rep-pillars">' +
      items.map(function (p) {
        return '<div class="repeater-row"><div class="form-grid">' +
          '<div class="field full"><label>标题</label><input class="pl-title" type="text" value="' + escapeAttr(p.title || '') + '"></div>' +
          '<div class="field full"><label>说明</label><textarea class="pl-body">' + escapeHtml(p.body || '') + '</textarea></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-generic">＋ 添加支柱</button></div>';
  }

  function collectPillars() {
    var root = $('rep-pillars');
    if (!root) return [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row) {
      return {
        title: (row.querySelector('.pl-title') || {}).value || '',
        body: (row.querySelector('.pl-body') || {}).value || '',
      };
    }).filter(function (x) { return x.title || x.body; });
  }

  function culturePillarsHtml(items) {
    items = items && items.length ? items : [{ title: '', bodyHtml: '' }];
    return '<div class="repeater" id="rep-culture-pillars">' +
      items.map(function (p, i) {
        return '<div class="repeater-row" data-source-index="' + i + '"><div class="form-grid">' +
          '<div class="field full"><label>标题</label><input class="cp-title" type="text" value="' + escapeAttr(p.title || '') + '"></div>' +
          '<div class="field full"><label>正文</label><textarea class="cp-body">' + escapeHtml(textFromHtml(p.bodyHtml || '')) + '</textarea>' +
          '<p class="field-help">直接输入文字和换行，无需填写 HTML。</p></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-generic">＋ 添加支柱</button></div>';
  }
  function collectCulturePillars(prevItems) {
    var root = $('rep-culture-pillars');
    if (!root) return [];
    prevItems = prevItems || [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row, i) {
      var prev = prevItems[rowSourceIndex(row, i)] || {};
      return Object.assign({}, prev, {
        title: (row.querySelector('.cp-title') || {}).value || '',
        bodyHtml: textToHtml((row.querySelector('.cp-body') || {}).value || ''),
      });
    }).filter(function (x) { return x.title || x.bodyHtml; });
  }
  function clientsItemsHtml(items) {
    items = items && items.length ? items : [{ image: '', imageAlt: '' }];
    return '<div class="repeater" id="rep-clients">' +
      items.map(function (it, i) {
        return '<div class="repeater-row" data-source-index="' + i + '"><div class="form-grid">' +
          '<div class="field full image-field"><label>Logo</label><div class="image-field-row">' +
          '<input class="cl-image" type="text" value="' + escapeAttr(it.image || '') + '">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-pick-inline>从媒体库选图</button></div></div>' +
          '<div class="field full"><label>客户名称</label><input class="cl-alt" type="text" value="' + escapeAttr(it.imageAlt || '') + '"></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-generic">＋ 添加客户</button></div>';
  }
  function collectClientsItems(prevItems) {
    var root = $('rep-clients');
    if (!root) return [];
    prevItems = prevItems || [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row, i) {
      var prev = prevItems[rowSourceIndex(row, i)] || {};
      return Object.assign({}, prev, {
        image: (row.querySelector('.cl-image') || {}).value || '',
        imageAlt: (row.querySelector('.cl-alt') || {}).value || '',
      });
    }).filter(function (x) { return x.image || x.imageAlt; });
  }
  function carouselSlidesHtml(slides) {
    slides = slides && slides.length ? slides : [{ image: '', tag: '', title: '', desc: '', dotLabel: '' }];
    return '<div class="repeater" id="rep-carousel">' +
      slides.map(function (s, i) {
        return '<div class="repeater-row" data-source-index="' + i + '"><div class="form-grid">' +
          '<div class="field full image-field"><label>图片</label><div class="image-field-row">' +
          '<input class="cs-image" type="text" value="' + escapeAttr(s.image || '') + '">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-pick-inline>从媒体库选图</button></div></div>' +
          '<div class="field"><label>标题</label><input class="cs-title" type="text" value="' + escapeAttr(s.title || '') + '"></div>' +
          '<div class="field"><label>上方标签</label><input class="cs-tag" type="text" value="' + escapeAttr(s.tag || '') + '"></div>' +
          '<div class="field full"><label>描述</label><input class="cs-desc" type="text" value="' + escapeAttr(s.desc || '') + '"></div>' +
          '<div class="field"><label>切换标签</label><input class="cs-dot" type="text" value="' + escapeAttr(s.dotLabel || '') + '"></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-generic">＋ 添加幻灯片</button></div>';
  }
  function collectCarouselSlides(prevSlides) {
    var root = $('rep-carousel');
    if (!root) return [];
    prevSlides = prevSlides || [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row, i) {
      var prev = prevSlides[rowSourceIndex(row, i)] || {};
      var title = (row.querySelector('.cs-title') || {}).value || '';
      return Object.assign({}, prev, {
        image: (row.querySelector('.cs-image') || {}).value || '',
        imageAlt: title,
        tag: (row.querySelector('.cs-tag') || {}).value || '',
        title: title,
        desc: (row.querySelector('.cs-desc') || {}).value || '',
        dotLabel: (row.querySelector('.cs-dot') || {}).value || '',
        dotAria: title,
      });
    }).filter(function (x) { return x.image || x.title; });
  }
  function timelineEventsHtml(events) {
    events = events && events.length ? events : [{ year: '', bodyHtml: '', mobileBody: '' }];
    return '<div class="repeater" id="rep-timeline">' +
      events.map(function (ev, i) {
        return '<div class="repeater-row" data-source-index="' + i + '">' +
          '<div class="repeater-row-head"><strong>历程 ' + (i + 1) + '</strong>' +
          '<span class="help">左右位置和强调样式由系统自动处理</span></div><div class="form-grid">' +
          '<div class="field"><label>年份</label><input class="tl-year" type="text" value="' + escapeAttr(ev.year || '') + '"></div>' +
          '<div class="field full"><label>重点一句（可选）</label><textarea class="tl-lead">' + escapeHtml(textFromHtml(ev.leadHtml || '')) + '</textarea></div>' +
          '<div class="field full"><label>详细内容</label><textarea class="tl-body">' + escapeHtml(textFromHtml(ev.bodyHtml || '')) + '</textarea></div>' +
          '<div class="field full"><label>手机端精简内容（可选）</label><textarea class="tl-mobile">' + escapeHtml(textFromHtml(ev.mobileBody || '')) + '</textarea>' +
          '<p class="field-help">留空时手机端自动使用详细内容。</p></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-generic">＋ 添加事件</button></div>';
  }
  function collectTimelineEvents() {
    var root = $('rep-timeline');
    if (!root) return [];
    var rows = Array.prototype.slice.call(root.querySelectorAll(':scope > .repeater-row'));
    return rows.map(function (row, i) {
      var lead = (row.querySelector('.tl-lead') || {}).value || '';
      var body = (row.querySelector('.tl-body') || {}).value || '';
      var mobile = (row.querySelector('.tl-mobile') || {}).value || '';
      return {
        year: (row.querySelector('.tl-year') || {}).value || '',
        side: i % 2 === 0 ? 'left' : 'right',
        accent: i === 0 || i === rows.length - 1,
        yearAccent: i === rows.length - 1,
        leadHtml: lead ? textToHtml(lead) : '',
        bodyHtml: textToHtml(body),
        mobileBody: mobile ? textToHtml(mobile) : '',
      };
    }).filter(function (x) { return x.year || x.bodyHtml; });
  }
  function credentialsGroupsHtml(groups) {
    groups = groups && groups.length ? groups : [{ id: '', title: '', layout: 'grid', items: [] }];
    return '<div class="repeater" id="rep-cred-groups">' +
      groups.map(credGroupRowHtml).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-cred-group">＋ 添加分组</button></div>';
  }

  function bindCredentialsRepeater() {
    var root = $('rep-cred-groups');
    if (!root || root._bound) return;
    root._bound = true;
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (t.classList.contains('rep-add-cred-group')) {
        var wrap = document.createElement('div');
        wrap.innerHTML = credGroupRowHtml({ id: '', title: '', layout: 'grid', items: [{ image: '', imageAlt: '' }] });
        var row = wrap.firstChild;
        root.insertBefore(row, t);
        bindRepeaterMedia(row);
      }
      if (t.classList.contains('rep-add-cred-item')) {
        var nest = t.closest('.nested-rep');
        var item = document.createElement('div');
        item.className = 'repeater-row';
        item.innerHTML = CRED_ITEM_BLANK;
        nest.insertBefore(item, t);
        bindRepeaterMedia(item);
      }
      if (t.classList.contains('rep-remove-item')) {
        var itemRow = t.closest('.repeater-row');
        var nest2 = t.closest('.nested-rep');
        if (itemRow && nest2 && nest2.querySelectorAll(':scope > .repeater-row').length > 1) itemRow.remove();
      }
      if (t.classList.contains('rep-remove') && t.closest('.cred-group')) {
        var g = t.closest('.cred-group');
        if (g && root.querySelectorAll(':scope > .cred-group').length > 1) g.remove();
      }
    });
  }

  function collectCredentialsGroups(prevGroups) {
    var root = $('rep-cred-groups');
    if (!root) return [];
    prevGroups = prevGroups || [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .cred-group'), function (group, i) {
      var prev = prevGroups[rowSourceIndex(group, i)] || {};
      var title = (group.querySelector('.cg-title') || {}).value || '';
      var prevItems = prev.items || [];
      var items = Array.prototype.map.call(group.querySelectorAll('.nested-rep > .repeater-row'), function (row, itemIndex) {
        var prevItem = prevItems[rowSourceIndex(row, itemIndex)] || {};
        return Object.assign({}, prevItem, {
          image: (row.querySelector('.ci-image') || {}).value || '',
          imageAlt: prevItem.imageAlt || title,
        });
      }).filter(function (x) { return x.image; });
      return Object.assign({}, prev, {
        id: prev.id || ('group-' + (i + 1)),
        title: title,
        layout: prev.layout || 'grid',
        items: items,
      });
    }).filter(function (x) { return x.title || (x.items && x.items.length); });
  }
  function bindLeafRepeaterRemove(rootId) {
    var root = $(rootId);
    if (!root || root._removeBound) return;
    root._removeBound = true;
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (!t.classList.contains('rep-remove')) return;
      var row = t.closest('.repeater-row');
      if (!row || row.parentElement !== root) return;
      if (root.querySelectorAll(':scope > .repeater-row').length > 1) row.remove();
    });
  }

  async function loadPageForm(key) {
    destroyRichEditors();
    var page = await api('/admin/pages/' + key);
    state.pageCache[key] = page;
    if (key === 'home') {
      renderHomeForm(page);
    } else if (key === 'about') {
      renderAboutForm(page);
    } else if (key === 'contact') {
      renderContactForm(page);
    } else if (key === 'products' || key === 'news' || key === 'solutions') {
      renderListPageForm(key, page);
    }
  }

  function renderHomeForm(page) {
    var hero = page.hero || {};
    var feat = page.featured || {};
    var about = page.aboutSection || {};
    var products = page.productsSection || {};
    var service = page.serviceSection || {};
    var news = page.newsSection || {};
    var unit = products.unitCard || (products.cards || []).filter(function (c) {
      return /products\.html/i.test(c.href || '');
    })[0] || {
      eyebrow: 'Single Machines',
      title: '单元设备',
      summary: '',
      tags: [],
      href: 'products.html',
      image: '',
      imageAlt: '',
    };
    var slotsHtml = '<div class="card" id="home-slots-status"><h3 class="card-title">首页推荐内容</h3>' +
      '<p class="field-help">标杆 / 精选在「解决方案」「新闻中心」的条目详情里设置；下架正在展示的内容时，需要先选择替代内容。</p>' +
      '<p class="help">加载中…</p></div>';
    var sections = [
      { key: 'seo', label: '搜索设置', html: seoBlock(page) },
      {
        key: 'hero', label: '首屏区域',
        html: cardBlock('首屏区域',
          field('hero-title', '主标题', hero.title) + field('hero-lead', '副文案', hero.lead, 'full', 'textarea') +
          field('hero-cta1-label', '主按钮文案', (hero.primaryCta || {}).label) + pageLinkSelect('hero-cta1-href', '主按钮跳转到', (hero.primaryCta || {}).href) +
          field('hero-cta2-label', '次按钮文案', (hero.secondaryCta || {}).label) + pageLinkSelect('hero-cta2-href', '次按钮跳转到', (hero.secondaryCta || {}).href)),
      },
      {
        key: 'featured', label: '标杆方案',
        html: cardBlock('标杆方案区文案',
          field('feat-eyebrow', '眉题', feat.eyebrow || '标杆方案') +
          field('feat-subtitle', '副标题覆盖（可选，空则用方案亮点）', feat.subtitle || '', 'full') +
          field('feat-cta', '按钮文案', feat.cta || '查看方案详情 →', 'full')),
      },
      { key: 'slots', label: '推荐内容', badge: '自动', html: slotsHtml },
      {
        key: 'about', label: '公司简介', badge: (about.stats || []).length,
        html: '<div class="card"><h3 class="card-title">关于区块</h3><div class="form-grid">' +
          field('about-title', '标题', about.title, 'full') +
          richTextField('about-body', '正文', about.bodyHtml || '', '支持加粗、换行等基础排版') +
          '</div><h4 class="sub-title">核心数据</h4>' + statsRowsHtml(about.stats || []) + '</div>',
      },
      {
        key: 'products', label: '核心业务',
        html: '<div class="card"><h3 class="card-title">产品类目区块</h3><div class="form-grid">' +
          field('prod-sec-title', '标题', products.title, 'full') +
          field('prod-sec-subtitle', '副标题', products.subtitle, 'full', 'textarea') +
          '<p class="form-section-title">固定卡片 · 单元设备</p>' +
          field('unit-eyebrow', '眉题', unit.eyebrow) +
          field('unit-title', '标题', unit.title, 'full') +
          field('unit-summary', '简介', unit.summary, 'full', 'textarea') +
          field('unit-tags', '标签（每行一条）', (unit.tags || []).join('\n'), 'full', 'textarea') +
          imageField('unit-image', '图片', unit.image || '') +
          '</div></div>',
      },
      {
        key: 'service', label: '服务流程', badge: (service.steps || []).length,
        html: '<div class="card"><h3 class="card-title">服务流程区块</h3><div class="form-grid">' +
          field('svc-sec-title', '标题', service.title, 'full') +
          field('svc-sec-subtitle', '副标题', service.subtitle, 'full', 'textarea') +
          '</div><h4 class="sub-title">步骤</h4>' + homeServiceStepsHtml(service.steps || []) + '</div>',
      },
      {
        key: 'news', label: '精选新闻',
        html: '<div class="card"><h3 class="card-title">新闻区块文案</h3><div class="form-grid">' +
          field('news-sec-title', '标题', news.title, 'full') +
          field('news-sec-mission-title', '初心标题', news.missionTitle) +
          field('news-sec-mission-body', '初心正文', news.missionBody, 'full', 'textarea') +
          field('news-sec-cta-label', '按钮文案', (news.cta || {}).label) +
          pageLinkSelect('news-sec-cta-href', '按钮跳转到', (news.cta || {}).href) +
          '<div class="field full"><p class="field-help">精选新闻请在「新闻中心 → 新闻管理」详情中设置（最多 2 条）。</p></div>' +
          '</div></div>',
      },
    ];
    $('page-home-form').innerHTML = buildSectionTabs('page-home-form', sections, 'hero');
    bindSectionTabs('page-home-form');
    bindPageDirty('page-home-form', 'home');
    bindImageFields($('page-home-form'));
    bindStatsRepeater();
    bindGenericRepeater('rep-home-steps', HOME_STEP_BLANK);
    bindLeafRepeaterRemove('rep-home-steps');
    initRichEditors(['f-about-body']);
    loadHomeSlotsStatus();
  }

  async function loadHomeSlotsStatus() {
    var box = $('home-slots-status');
    if (!box) return;
    try {
      var data = await api('/admin/home-slots');
      function listBlock(title, bucket, hubView) {
        var items = (bucket && bucket.items) || [];
        var limit = (bucket && bucket.limit) || 0;
        var rows = items.length
          ? '<ul style="margin:6px 0 0;padding-left:18px">' + items.map(function (it) {
            return '<li>' + escapeHtml(it.name || it.title || '未命名内容') +
              (hubView
                ? ' <button type="button" class="btn btn-ghost btn-sm hub-slot-edit" data-hub-jump="' +
                  escapeAttr(hubView) + '" data-edit-id="' + escapeAttr(it.id) + '">去编辑</button>'
                : '') +
              '</li>';
          }).join('') + '</ul>'
          : '<p class="help" style="margin:6px 0 0">（空）</p>';
        return '<div style="margin-top:10px"><strong>' + escapeHtml(title) + '</strong> ' +
          '<span class="help">' + items.length + '/' + limit + '</span>' + rows + '</div>';
      }
      box.innerHTML =
        '<h3 class="card-title">首页推荐内容</h3>' +
        '<p class="field-help">在「解决方案 / 新闻中心」的条目详情里设置；只有已发布内容会显示在首页。</p>' +
        listBlock('标杆方案（首屏大图）', data.hero, 'page-solutions') +
        listBlock('精选方案（三大核心类目）', data.category, 'page-solutions') +
        listBlock('精选新闻', data.news, 'page-news');
      box.querySelectorAll('.hub-slot-edit').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var view = btn.getAttribute('data-hub-jump');
          var id = btn.getAttribute('data-edit-id');
          Promise.resolve(setView(view, { hubTab: 'items' })).then(function () {
            if (view === 'page-solutions') return openSolution(id);
            if (view === 'page-news') return openNews(id);
          }).catch(function (e) { toast(e.message, true); });
        });
      });
    } catch (err) {
      box.innerHTML = '<h3 class="card-title">首页推荐内容</h3><p class="help">' + escapeHtml(err.message) + '</p>';
    }
  }

  function collectHomeForm() {
    var prevStats = (((state.pageCache.home || {}).aboutSection || {}).stats) || [];
    return {
      pageKey: 'home', lang: 'zh',
      seo: collectSeo(),
      hero: {
        title: val('f-hero-title'), lead: val('f-hero-lead'),
        primaryCta: { label: val('f-hero-cta1-label'), href: val('f-hero-cta1-href') },
        secondaryCta: { label: val('f-hero-cta2-label'), href: val('f-hero-cta2-href') },
      },
      featured: {
        eyebrow: val('f-feat-eyebrow'),
        subtitle: val('f-feat-subtitle'),
        cta: val('f-feat-cta'),
      },
      aboutSection: {
        title: val('f-about-title'),
        bodyHtml: getRichHtml('about-body'),
        stats: collectStatsFrom('rep-stats', prevStats),
      },
      productsSection: {
        title: val('f-prod-sec-title'),
        subtitle: val('f-prod-sec-subtitle'),
        unitCard: {
          eyebrow: val('f-unit-eyebrow'),
          title: val('f-unit-title'),
          summary: val('f-unit-summary'),
          tags: val('f-unit-tags').split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
          href: 'products.html',
          image: val('f-unit-image'),
          imageAlt: val('f-unit-title'),
        },
      },
      serviceSection: {
        title: val('f-svc-sec-title'),
        subtitle: val('f-svc-sec-subtitle'),
        steps: collectHomeServiceSteps(),
      },
      newsSection: {
        title: val('f-news-sec-title'),
        missionTitle: val('f-news-sec-mission-title'),
        missionBody: val('f-news-sec-mission-body'),
        cta: { label: val('f-news-sec-cta-label'), href: val('f-news-sec-cta-href') },
      },
    };
  }

  function renderAboutForm(page) {
    var hero = page.hero || {};
    var culture = page.culture || {};
    var clients = page.clients || {};
    var credentials = page.credentials || {};
    var carousel = page.carousel || {};
    var stats = page.stats || {};
    var timeline = page.timeline || {};
    var sections = [
      { key: 'seo', label: '搜索设置', html: seoBlock(page) },
      {
        key: 'hero', label: '首屏区域',
        html: cardBlock('首屏区域',
          field('hero-title', '标题', hero.title, 'full') +
          richTextField('hero-lead', '导语', hero.leadHtml || '', '支持加粗等基础排版')),
      },
      {
        key: 'carousel', label: '工厂环境', badge: (carousel.slides || []).length,
        html: '<div class="card"><h3 class="card-title">工厂环境</h3><div class="form-grid">' +
          '</div><h4 class="sub-title">幻灯片</h4>' + carouselSlidesHtml(carousel.slides || []) + '</div>',
      },
      {
        key: 'stats', label: '核心数据', badge: (stats.items || []).length,
        html: '<div class="card"><h3 class="card-title">核心数据</h3><div class="form-grid">' +
          '</div><h4 class="sub-title">条目</h4>' + statsRowsHtml(stats.items || []) + '</div>',
      },
      {
        key: 'culture', label: '企业文化', badge: (culture.pillars || []).length,
        html: '<div class="card"><h3 class="card-title">企业文化</h3><div class="form-grid">' +
          richTextField('culture-headline', '标语', culture.headlineHtml || '') +
          '</div><h4 class="sub-title">支柱</h4>' + culturePillarsHtml(culture.pillars || []) + '</div>',
      },
      {
        key: 'timeline', label: '发展历程', badge: (timeline.events || []).length,
        html: '<div class="card"><h3 class="card-title">发展历程</h3><div class="form-grid">' +
          field('timeline-title', '标题', timeline.title || '', 'full') +
          field('timeline-subtitle', '副标题', timeline.subtitle || '', 'full', 'textarea') +
          '</div><h4 class="sub-title">事件</h4>' + timelineEventsHtml(timeline.events || []) + '</div>',
      },
      {
        key: 'credentials', label: '资质荣誉', badge: (credentials.groups || []).length,
        html: '<div class="card"><h3 class="card-title">资质荣誉</h3><div class="form-grid">' +
          field('cred-title', '标题', credentials.title || '', 'full') +
          field('cred-subtitle', '副标题', credentials.subtitle || '', 'full', 'textarea') +
          '</div><h4 class="sub-title">分组</h4>' + credentialsGroupsHtml(credentials.groups || []) + '</div>',
      },
      {
        key: 'clients', label: '合作客户', badge: (clients.items || []).length,
        html: '<div class="card"><h3 class="card-title">合作客户</h3><div class="form-grid">' +
          field('clients-title', '标题', clients.title || '', 'full') +
          field('clients-subtitle', '副标题', clients.subtitle || '', 'full', 'textarea') +
          '</div><h4 class="sub-title">Logo 列表</h4>' + clientsItemsHtml(clients.items || []) + '</div>',
      },
    ];
    $('page-about-form').innerHTML = buildSectionTabs('page-about-form', sections, 'hero');
    bindSectionTabs('page-about-form');
    bindPageDirty('page-about-form', 'about');
    bindImageFields($('page-about-form'));
    bindStatsRepeater();
    bindGenericRepeater('rep-culture-pillars', CULTURE_PILLAR_BLANK);
    bindGenericRepeater('rep-carousel', CAROUSEL_SLIDE_BLANK);
    bindGenericRepeater('rep-timeline', TIMELINE_BLANK);
    bindGenericRepeater('rep-clients', CLIENT_BLANK);
    bindLeafRepeaterRemove('rep-culture-pillars');
    bindLeafRepeaterRemove('rep-carousel');
    bindLeafRepeaterRemove('rep-timeline');
    bindLeafRepeaterRemove('rep-clients');
    bindCredentialsRepeater();
    bindRepeaterMedia($('page-about-form'));
    initRichEditors(['f-hero-lead', 'f-culture-headline']);
  }

  function collectAboutForm() {
    var prev = state.pageCache.about || {};
    var prevStats = ((prev.stats || {}).items) || [];
    var prevSlides = ((prev.carousel || {}).slides) || [];
    return {
      pageKey: 'about', lang: 'zh',
      seo: collectSeo(),
      hero: { title: val('f-hero-title'), leadHtml: getRichHtml('hero-lead') },
      culture: {
        headlineHtml: getRichHtml('culture-headline'),
        pillars: collectCulturePillars(((prev.culture || {}).pillars) || []),
      },
      carousel: {
        sectionAriaLabel: (prev.carousel || {}).sectionAriaLabel || '工厂环境',
        prevLabel: (prev.carousel || {}).prevLabel || '上一张',
        nextLabel: (prev.carousel || {}).nextLabel || '下一张',
        slides: collectCarouselSlides(prevSlides),
      },
      stats: {
        columns: (prev.stats || {}).columns || 5,
        items: collectStatsFrom('rep-stats', prevStats),
      },
      timeline: {
        title: val('f-timeline-title'),
        subtitle: val('f-timeline-subtitle'),
        events: collectTimelineEvents(),
      },
      credentials: {
        title: val('f-cred-title'),
        subtitle: val('f-cred-subtitle'),
        groups: collectCredentialsGroups(((prev.credentials || {}).groups) || []),
      },
      clients: {
        title: val('f-clients-title'),
        subtitle: val('f-clients-subtitle'),
        items: collectClientsItems(((prev.clients || {}).items) || []),
      },
    };
  }

  function locationRowsHtml(items) {
    items = items && items.length ? items : [{ name: '', address: '', badge: '' }];
    return '<div class="repeater" id="rep-locations">' +
      items.map(function (loc, i) {
        return '<div class="repeater-row" data-source-index="' + i + '">' +
          '<div class="repeater-row-head"><strong>公司地址 ' + (i + 1) + '</strong>' +
          '<span class="help">导航按钮和标记颜色由系统处理</span></div><div class="form-grid">' +
          '<div class="field"><label>基地名称</label><input class="loc-name" type="text" value="' + escapeAttr(loc.name || '') + '"></div>' +
          '<div class="field"><label>状态徽章（可选）</label><input class="loc-badge" type="text" value="' + escapeAttr(loc.badge || '') + '"></div>' +
          '<div class="field full"><label>详细地址</label><input class="loc-address" type="text" value="' + escapeAttr(loc.address || '') + '"></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-loc">＋ 添加地址</button></div>';
  }
  function bindLocationRepeater() {
    var root = $('rep-locations');
    if (!root || root._bound) return;
    root._bound = true;
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (t.classList.contains('rep-add-loc')) {
        var row = document.createElement('div');
        row.className = 'repeater-row';
        row.innerHTML = '<div class="repeater-row-head"><strong>新公司地址</strong>' +
          '<span class="help">导航按钮和标记颜色由系统处理</span></div><div class="form-grid">' +
          '<div class="field"><label>基地名称</label><input class="loc-name" type="text"></div>' +
          '<div class="field"><label>状态徽章（可选）</label><input class="loc-badge" type="text"></div>' +
          '<div class="field full"><label>详细地址</label><input class="loc-address" type="text"></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';
        root.insertBefore(row, t);
      }
      if (t.classList.contains('rep-remove')) {
        var rowToRemove = t.closest('.repeater-row');
        if (rowToRemove && root.querySelectorAll(':scope > .repeater-row').length > 1) rowToRemove.remove();
      }
    });
  }
  function collectLocations(prevItems) {
    var root = $('rep-locations');
    if (!root) return [];
    prevItems = prevItems || [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row, i) {
      var prev = prevItems[rowSourceIndex(row, i)] || {};
      var address = (row.querySelector('.loc-address') || {}).value || '';
      var badge = (row.querySelector('.loc-badge') || {}).value || '';
      var loc = Object.assign({}, prev, {
        name: (row.querySelector('.loc-name') || {}).value || '',
        address: address,
        navLabel: prev.navLabel || '高德地图导航',
        navUrl: prev.navUrl || ('https://uri.amap.com/search?keyword=' + encodeURIComponent(address)),
        dotColor: prev.dotColor || (i === 0 ? '#1D1D1F' : '#FF6B00'),
      });
      if (badge) loc.badge = badge;
      else delete loc.badge;
      return loc;
    }).filter(function (x) { return x.name || x.address; });
  }
  function renderContactForm(page) {
    var hero = page.hero || {};
    var map = page.map || {};
    var center = (map.center || []).join(', ');
    var mapAdvanced = advancedBlock(
      field('map-center', '地图中心坐标', center, 'full') +
      field('map-zoom', '地图缩放级别', map.zoom != null ? map.zoom : 14) +
      '<div class="field full"><p class="field-help">一般无需修改；后续会升级为地图选点。</p></div>');
    var sections = [
      { key: 'seo', label: '搜索设置', html: seoBlock(page) },
      {
        key: 'hero', label: '首屏区域',
        html: cardBlock('首屏区域', field('hero-title', '标题', hero.title, 'full') + field('hero-lead', '导语', hero.lead, 'full', 'textarea')),
      },
      {
        key: 'channels', label: '联系方式', badge: (page.channels || []).length,
        html: '<div class="card"><h3 class="card-title">联系方式</h3>' +
          '<p class="field-help">电话、WhatsApp 和邮箱使用固定卡片；填写显示内容即可。</p>' +
          channelRowsHtml(page.channels || []) + '</div>',
      },
      {
        key: 'map', label: '地图位置',
        html: cardBlock('地图区域', field('map-title', '区域标题', map.title || '', 'full')) + mapAdvanced,
      },
      {
        key: 'locations', label: '公司地址', badge: (page.locations || []).length,
        html: '<div class="card"><h3 class="card-title">公司地址</h3>' + locationRowsHtml(page.locations || []) + '</div>',
      },
    ];
    $('page-contact-form').innerHTML = buildSectionTabs('page-contact-form', sections, 'hero');
    bindSectionTabs('page-contact-form');
    bindPageDirty('page-contact-form', 'contact');
    bindLocationRepeater();
    bindImageFields($('page-contact-form'));
  }
  function collectContactForm() {
    var prev = state.pageCache.contact || {};
    var centerRaw = val('f-map-center').split(/[,，\s]+/).map(Number).filter(function (n) { return !isNaN(n); });
    var prevMap = prev.map || {};
    return {
      pageKey: 'contact', lang: 'zh',
      seo: collectSeo(),
      hero: { title: val('f-hero-title'), lead: val('f-hero-lead') },
      channels: collectChannels(prev.channels || []),
      map: {
        title: val('f-map-title'),
        center: centerRaw.length >= 2 ? [centerRaw[0], centerRaw[1]] : (prevMap.center || [114.316297, 22.726056]),
        zoom: Number(val('f-map-zoom')) || prevMap.zoom || 14,
      },
      locations: collectLocations(prev.locations || []),
    };
  }
  function renderListPageForm(key, page) {
    var formId = 'page-' + key + '-form';
    var filters = page.filters || {};
    var extraSection;
    if (key === 'solutions') {
      extraSection = {
        key: 'pillars',
        label: '价值说明',
        html: '<div class="card"><h3 class="card-title">价值支柱</h3>' + pillarsRowsHtml(page.pillars || []) + '</div>',
      };
    } else {
      extraSection = {
        key: 'filters',
        label: '筛选文案',
        html: cardBlock('筛选文案',
          field('filters-all', '「全部」按钮文案', filters.all || (key === 'news' ? '全部资讯' : '全部产品'), 'full') +
          '<div class="field full"><p class="field-help">分类按钮文案由当前栏目的「分类管理」维护，保存后会自动同步到当前页面。</p></div>'),
      };
    }
    var filterSection = key === 'solutions'
      ? {
        key: 'filters',
        label: '筛选文案',
        html: cardBlock('筛选文案',
          field('filters-all', '「全部」按钮文案', filters.all || '全部方案', 'full') +
          '<div class="field full"><p class="field-help">分类按钮文案由当前栏目的「分类管理」维护，保存后会自动同步到当前页面。</p></div>'),
      }
      : null;
    var sections = [
      { key: 'seo', label: '搜索设置', html: seoBlock(page) },
      {
        key: 'hero', label: '首屏区域',
        html: cardBlock('首屏区域',
          field('hero-title', '标题', (page.hero || {}).title, 'full') +
          field('hero-lead', '导语', (page.hero || {}).lead || '', 'full', 'textarea')),
      },
    ];
    if (filterSection) sections.push(filterSection);
    sections.push(extraSection);
    $(formId).innerHTML = buildSectionTabs(formId, sections, 'hero');
    bindSectionTabs(formId);
    bindPageDirty(formId, key);
    bindImageFields($(formId));
    if (key === 'solutions') {
      bindGenericRepeater('rep-pillars', PILLAR_BLANK);
      bindLeafRepeaterRemove('rep-pillars');
    }
  }

  function collectListPageForm(key) {
    var body = {
      pageKey: key, lang: 'zh',
      seo: collectSeo(),
      hero: { title: val('f-hero-title'), lead: val('f-hero-lead') },
    };
    if (key === 'solutions') {
      body.pillars = collectPillars();
      var prevFilters = ((state.pageCache[key] || {}).filters) || {};
      body.filters = Object.assign({}, prevFilters, { all: val('f-filters-all') || prevFilters.all || '全部方案' });
    } else {
      var prev = ((state.pageCache[key] || {}).filters) || {};
      body.filters = Object.assign({}, prev, { all: val('f-filters-all') || prev.all || '' });
    }
    return body;
  }

  async function savePage(key) {
    var saveButton = $('save-page-' + key);
    var originalLabel = saveButton ? saveButton.textContent : '';
    try {
      if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = '正在保存…';
      }
      setPageStatus(key, '正在保存“' + (PAGE_LABELS[key] || '当前页面') + '”…', 'saving');
      var body;
      if (key === 'home') body = collectHomeForm();
      else if (key === 'about') body = collectAboutForm();
      else if (key === 'contact') body = collectContactForm();
      else body = collectListPageForm(key);
      await api('/admin/pages/' + key, { method: 'PUT', body: JSON.stringify(body) });
      state.pageCache[key] = body;
      setPageDirty(key, false);
      var now = new Date();
      var savedAt = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      setPageStatus(key, '已保存于 ' + savedAt + ' · 英文和俄文版本等待同步', 'saved');
      flashInlineSaveBar(key);
      toast('“' + (PAGE_LABELS[key] || '页面') + '”已保存');
    } catch (err) {
      state.dirtyPages[key] = true;
      setPageStatus(key, '保存失败，请检查后重试', 'error');
      toast(err.message || '保存失败', true);
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = originalLabel;
      }
    }
  }

  /* Site i18n — form fields + advanced JSON */
  function siteKvFields(prefix, obj, labels) {
    obj = obj || {};
    return Object.keys(labels).map(function (key) {
      return field(prefix + '-' + key, labels[key], obj[key] != null ? obj[key] : '');
    }).join('');
  }

  function collectSiteKv(prefix, labels) {
    var out = {};
    Object.keys(labels).forEach(function (key) {
      out[key] = val('f-' + prefix + '-' + key);
    });
    return out;
  }

  var SITE_NAV_LABELS = {
    home: '首页', about: '关于我们', solutions: '解决方案',
    products: '产品中心', news: '新闻中心', contact: '联系我们',
  };
  var SITE_LANG_LABELS = { zh: '中文标签', en: '英文标签', ru: '俄文标签' };
  var SITE_COMMON_LABELS = {
    relatedProducts: '相关产品', relatedSolutions: '相关解决方案', relatedArticles: '相关文章',
    coreParams: '核心参数', productFeatures: '产品特点', detailTitle: '详细说明',
    backToProducts: '返回产品中心', backToSolutions: '返回解决方案', breadcrumbHome: '面包屑·首页',
    industryPainPoints: '行业痛点', coreProcess: '核心工艺流程', applicationAreas: '应用领域',
    techAdvantages: '技术优势',
  };
  var SITE_FOOTER_LABELS = {
    tagline: '页脚标语', copyright: '版权文案', icp: '备案号',
  };

  async function loadSiteForm() {
    var site = await api('/admin/site');
    state.siteCache = site;
    var sections = [
      { key: 'nav', label: '网站顶部', html: cardBlock('顶部导航名称', siteKvFields('nav', site.nav, SITE_NAV_LABELS)) },
      { key: 'common', label: '通用文案', html: cardBlock('全站通用文案', siteKvFields('common', site.common, SITE_COMMON_LABELS)) },
      { key: 'footer', label: '网站底部', html: cardBlock('网站底部可见内容', siteKvFields('footer', site.footer, SITE_FOOTER_LABELS)) },
    ];
    $('site-form').innerHTML = buildSectionTabs('site-form', sections, 'nav');
    bindSectionTabs('site-form');
  }
  async function saveSite() {
    try {
      var prev = state.siteCache || {};
      var body = {
        nav: Object.assign({}, prev.nav || {}, collectSiteKv('nav', SITE_NAV_LABELS)),
        lang: Object.assign({ zh: 'ZH', en: 'EN', ru: 'RU' }, prev.lang || {}),
        common: Object.assign({}, prev.common || {}, collectSiteKv('common', SITE_COMMON_LABELS)),
        footer: Object.assign({}, prev.footer || {}, collectSiteKv('footer', SITE_FOOTER_LABELS)),
      };
      await api('/admin/site', { method: 'PUT', body: JSON.stringify(body) });
      state.siteCache = body;
      toast('站点文案已保存');
    } catch (err) {
      toast(err.message || '保存失败', true);
    }
  }
  /* Media */
  function renderMediaGrid() {
    var grid = $('media-grid');
    if (!grid) return;
    var allItems = state.mediaItems || [];
    var q = String(($('media-search') || {}).value || '').trim().toLowerCase();
    var items = allItems.filter(function (m) {
      if (!q) return true;
      return [m.alt, m.filename, m.path].some(function (value) {
        return String(value || '').toLowerCase().indexOf(q) >= 0;
      });
    });
    if ($('media-count')) $('media-count').textContent = String(allItems.length);
    if (!allItems.length) {
      grid.innerHTML = '<p class="empty">暂无图片素材，点击右上角“上传图片”开始添加。</p>';
      return;
    }
    if (!items.length) {
      grid.innerHTML = '<p class="empty">没有匹配的图片素材，请更换搜索关键词。</p>';
      return;
    }
    grid.innerHTML = items.map(function (m) {
      var displayName = m.alt || '未填写图片说明';
      return '<div class="media-item">' +
        '<img src="' + escapeHtml(assetUrl(m.path)) + '" alt="' + escapeAttr(m.alt || '') + '">' +
        '<div class="meta"><strong class="media-item-title">' + escapeHtml(displayName) + '</strong>' +
        '<label class="media-item-label">素材名称 / 图片说明</label>' +
        '<input class="media-alt" data-id="' + escapeAttr(m.filename) + '" type="text" placeholder="例如：惠州生产基地外景" value="' + escapeAttr(m.alt || '') + '">' +
        '<div class="media-item-actions"><button type="button" class="btn btn-ghost btn-sm btn-danger-text" data-del="' + escapeAttr(m.filename) + '" data-name="' + escapeAttr(displayName) + '">删除</button></div>' +
        '</div></div>';
    }).join('');
    grid.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var name = btn.getAttribute('data-name') || '该图片';
        if (!confirm('确认删除“' + name + '”？删除后使用该图片的页面可能无法正常显示。')) return;
        try {
          await api('/admin/media/' + encodeURIComponent(btn.getAttribute('data-del')), { method: 'DELETE' });
          toast('图片已删除');
          loadMedia();
        } catch (err) { toast(err.message, true); }
      });
    });
    grid.querySelectorAll('.media-alt').forEach(function (input) {
      input.addEventListener('change', async function () {
        try {
          await api('/admin/media/' + encodeURIComponent(input.getAttribute('data-id')), {
            method: 'PUT',
            body: JSON.stringify({ alt: input.value }),
          });
          var item = (state.mediaItems || []).find(function (m) {
            return String(m.filename) === String(input.getAttribute('data-id'));
          });
          if (item) item.alt = input.value;
          toast('素材说明已保存');
        } catch (err) { toast(err.message, true); }
      });
    });
  }

  async function loadMedia() {
    var data = await api('/admin/media');
    state.mediaItems = data.items || [];
    renderMediaGrid();
  }

  function fileToBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadMedia(file) {
    var dataUrl = await fileToBase64(file);
    var saved = await api('/admin/media', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, data: dataUrl, mime: file.type }),
    });
    toast('已上传：' + saved.path);
    await loadMedia();
  }

  var RESOURCE_LABELS = {
    products: '产品中心（全部条目）',
    news: '新闻中心（全部条目）',
    solutions: '解决方案（全部条目）',
    site: '全站设置 · 公共区域',
    'pages:home': '首页文案',
    'pages:about': '关于我们文案',
    'pages:contact': '联系我们文案',
    'pages:products': '产品中心 · 列表页文案',
    'pages:news': '新闻中心 · 列表页文案',
    'pages:solutions': '解决方案 · 列表页文案',
  };
  var LANG_LABELS = { en: '英文', ru: '俄文' };
  var STATUS_LABELS = {
    stale: '待同步',
    current: '已同步',
    pending: '排队中',
    running: '翻译中',
    done: '已完成',
    failed: '失败',
    applied: '已应用',
  };

  function resourceLabel(key) {
    return RESOURCE_LABELS[key] || key;
  }

  function statusLabel(status) {
    return STATUS_LABELS[status] || status;
  }

  function collectStaleItems(resources) {
    var items = [];
    Object.keys(resources || {}).sort().forEach(function (key) {
      var langs = resources[key] || {};
      var need = [];
      if (langs.en === 'stale') need.push('en');
      if (langs.ru === 'stale') need.push('ru');
      if (need.length) {
        items.push({ resource: key, langs: need, en: langs.en, ru: langs.ru });
      }
    });
    return items;
  }

  function setTxSyncLock(on) {
    document.body.classList.toggle('tx-syncing', !!on);
    var syncBtn = $('sync-all-stale');
    if (syncBtn) {
      syncBtn.disabled = !!on;
      syncBtn.textContent = on ? '同步中…' : '立即同步';
    }
    var inline = $('tx-sync-inline');
    if (inline) {
      inline.disabled = !!on;
      inline.textContent = on ? '同步中…' : '立即同步';
    }
    ['enqueue-stale-jobs', 'refresh-jobs', 'refresh-translation'].forEach(function (id) {
      if ($(id)) $(id).disabled = !!on;
    });
    document.querySelectorAll('[data-sync-one], [data-run], [data-apply], [data-job-res], [data-res]').forEach(function (el) {
      el.disabled = !!on;
    });
  }

  function formatElapsed(ms) {
    var s = Math.max(0, Math.floor((ms || 0) / 1000));
    if (s < 60) return s + ' 秒';
    return Math.floor(s / 60) + ' 分 ' + (s % 60) + ' 秒';
  }

  function stopTxProgressTicker() {
    if (state.txSync && state.txSync._timer) {
      clearInterval(state.txSync._timer);
      state.txSync._timer = null;
    }
  }

  function startTxProgressTicker() {
    stopTxProgressTicker();
    state.txSync._timer = setInterval(function () {
      if (!state.txSync || !state.txSync.active) {
        stopTxProgressTicker();
        return;
      }
      var elapsed = $('tx-progress-elapsed');
      var itemElapsed = $('tx-progress-item-elapsed');
      var now = Date.now();
      if (elapsed && state.txSync.startedAt) {
        elapsed.textContent = formatElapsed(now - state.txSync.startedAt);
      }
      if (itemElapsed && state.txSync.itemStartedAt) {
        itemElapsed.textContent = formatElapsed(now - state.txSync.itemStartedAt);
      }
    }, 1000);
  }

  /** One pending job per resource (newest id). Never queue historical failed duplicates. */
  function collectPendingJobsForSync(listData) {
    var byRes = {};
    (listData.jobs || []).forEach(function (j) {
      if (!j || j.status !== 'pending') return;
      var prev = byRes[j.resource];
      if (!prev || Number(j.id) > Number(prev.id)) byRes[j.resource] = j;
    });
    return Object.keys(byRes).sort().map(function (key) {
      return { id: byRes[key].id, resource: byRes[key].resource };
    });
  }

  function renderTxProgress() {
    var box = $('translation-progress');
    if (!box) return;
    var sync = state.txSync;
    if (!sync.items.length) {
      stopTxProgressTicker();
      box.classList.add('hidden');
      box.innerHTML = '';
      return;
    }
    box.classList.remove('hidden');
    var busy = sync.active && sync.done < sync.total;
    var pct = sync.total ? Math.round((sync.done / sync.total) * 100) : 0;
    var pctLabel = busy && sync.done === 0 ? '进行中' : (pct + '%');
    var now = Date.now();
    var title = sync.active
      ? ('正在同步（' + Math.min(sync.done + 1, sync.total) + ' / ' + sync.total + '）')
      : (sync.failed
        ? ('同步结束：成功 ' + (sync.total - sync.failed) + '，失败 ' + sync.failed)
        : ('已完成 ' + sync.total + ' 项'));
    var sub = sync.active
      ? ('当前：' + (sync.currentLabel || '准备中…') +
        ' · 总用时 <span id="tx-progress-elapsed">' +
        escapeHtml(formatElapsed(sync.startedAt ? now - sync.startedAt : 0)) +
        '</span>（产品/方案整库翻译可能需几分钟，请稍候）')
      : (sync.failed ? '可重试失败项，或稍后再点「立即同步」。' : '英文 / 俄文已更新。');
    var barClass = 'tx-progress-bar-fill' + (busy ? ' is-busy' : '');
    var barWidth = busy && sync.done === 0 ? '100%' : (pct + '%');
    var list = sync.items.map(function (it, idx) {
      var mark = it.status === 'done' ? '✓' : (it.status === 'failed' ? '!' : (it.status === 'running' ? '…' : String(idx + 1)));
      var statusText = it.status === 'done' ? '完成'
        : (it.status === 'failed' ? ('失败' + (it.error ? '：' + it.error : ''))
          : (it.status === 'running'
            ? ('翻译中… 已用 <span id="tx-progress-item-elapsed">' +
              escapeHtml(formatElapsed(sync.itemStartedAt ? now - sync.itemStartedAt : 0)) +
              '</span>')
            : '等待中'));
      return '<li class="tx-progress-item is-' + escapeAttr(it.status) + '">' +
        '<span class="tx-progress-mark" aria-hidden="true">' + mark + '</span>' +
        '<div class="tx-progress-item-main">' +
        '<strong>' + escapeHtml(resourceLabel(it.resource)) + '</strong>' +
        '<span>' + statusText + '</span></div></li>';
    }).join('');
    var actions = '';
    if (!sync.active && sync.failed) {
      actions = '<div class="tx-progress-actions">' +
        '<button type="button" class="btn btn-accent btn-sm" id="tx-retry-failed">重试失败项</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" id="tx-progress-dismiss">关闭</button></div>';
    } else if (!sync.active && !sync.failed) {
      actions = '<div class="tx-progress-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm" id="tx-progress-dismiss">关闭</button></div>';
    }
    box.innerHTML =
      '<div class="tx-progress-card">' +
      '<div class="tx-progress-head">' +
      '<div><h3 class="tx-progress-title">' + escapeHtml(title) + '</h3>' +
      '<p class="tx-progress-sub">' + sub + '</p></div>' +
      '<span class="tx-progress-pct">' + escapeHtml(pctLabel) + '</span></div>' +
      '<div class="tx-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '">' +
      '<div class="' + barClass + '" style="width:' + barWidth + '"></div></div>' +
      '<ul class="tx-progress-list">' + list + '</ul>' + actions + '</div>';
    var retry = $('tx-retry-failed');
    if (retry) {
      retry.addEventListener('click', function () {
        retryFailedTxSync().catch(function (e) { toast(e.message || '重试失败', true); });
      });
    }
    var dismiss = $('tx-progress-dismiss');
    if (dismiss) {
      dismiss.addEventListener('click', function () {
        stopTxProgressTicker();
        state.txSync.items = [];
        state.txSync.failed = 0;
        renderTxProgress();
        loadTranslation().catch(function () {});
      });
    }
  }

  function onTxSyncBeforeUnload(e) {
    if (!state.txSync || !state.txSync.active) return;
    e.preventDefault();
    e.returnValue = '';
  }

  async function runTxSyncQueue(jobs) {
    if (state.txSync.active) {
      toast('正在同步中，请稍候', true);
      return;
    }
    if (!jobs || !jobs.length) {
      toast('没有需要同步的内容');
      return;
    }
    state.txSync = {
      active: true,
      preparing: false,
      items: jobs.map(function (j) {
        return { id: j.id, resource: j.resource, status: 'waiting', error: '' };
      }),
      done: 0,
      total: jobs.length,
      failed: 0,
      currentLabel: '',
      startedAt: Date.now(),
      itemStartedAt: 0,
      _timer: null,
    };
    setTxSyncLock(true);
    window.addEventListener('beforeunload', onTxSyncBeforeUnload);
    if ($('translation-overview')) $('translation-overview').classList.add('is-dimmed');
    if ($('translation-pending-card')) $('translation-pending-card').classList.add('is-dimmed');
    renderTxProgress();
    startTxProgressTicker();

    for (var i = 0; i < state.txSync.items.length; i++) {
      var item = state.txSync.items[i];
      item.status = 'running';
      state.txSync.currentLabel = resourceLabel(item.resource);
      state.txSync.itemStartedAt = Date.now();
      renderTxProgress();
      try {
        await api('/admin/translation-jobs/' + item.id + '/run', { method: 'POST', body: '{}' });
        item.status = 'done';
      } catch (err) {
        item.status = 'failed';
        item.error = err.message || '失败';
        state.txSync.failed += 1;
      }
      state.txSync.done += 1;
      renderTxProgress();
    }

    state.txSync.active = false;
    state.txSync.currentLabel = '';
    state.txSync.itemStartedAt = 0;
    stopTxProgressTicker();
    setTxSyncLock(false);
    window.removeEventListener('beforeunload', onTxSyncBeforeUnload);
    if ($('translation-overview')) $('translation-overview').classList.remove('is-dimmed');
    if ($('translation-pending-card')) $('translation-pending-card').classList.remove('is-dimmed');

    if (state.txSync.failed) {
      toast('同步结束：成功 ' + (state.txSync.total - state.txSync.failed) + '，失败 ' + state.txSync.failed, true);
      renderTxProgress();
      return;
    }
    toast('已完成 ' + state.txSync.total + ' 项翻译同步');
    renderTxProgress();
    setTimeout(function () {
      state.txSync.items = [];
      renderTxProgress();
      loadTranslation().catch(function () {});
    }, 900);
  }

  async function retryFailedTxSync() {
    if (state.txSync.active) return;
    var failed = (state.txSync.items || []).filter(function (it) { return it.status === 'failed'; });
    if (!failed.length) {
      toast('没有失败项');
      return;
    }
    await runTxSyncQueue(failed.map(function (it) {
      return { id: it.id, resource: it.resource };
    }));
  }

  async function syncAllStaleTranslations() {
    if (state.txSync.active || state.txSync.preparing) {
      toast('正在同步中，请稍候', true);
      return;
    }
    state.txSync.preparing = true;
    setTxSyncLock(true);
    try {
      toast('正在准备翻译任务…');
      await api('/admin/translation-jobs', {
        method: 'POST',
        body: JSON.stringify({ enqueueStale: true }),
      });
      var data = await api('/admin/translation-jobs');
      /* Only pending, one per resource — never re-queue old failed jobs */
      var jobs = collectPendingJobsForSync(data);
      if (!jobs.length) {
        toast('没有需要同步的内容');
        state.txSync.preparing = false;
        setTxSyncLock(false);
        loadTranslation();
        return;
      }
      state.txSync.preparing = false;
      setTxSyncLock(false);
      await runTxSyncQueue(jobs);
    } catch (err) {
      toast(err.message || '同步失败', true);
      state.txSync.preparing = false;
      setTxSyncLock(false);
      loadTranslation().catch(function () {});
    }
  }

  async function syncOneTranslation(resource) {
    if (state.txSync.active || state.txSync.preparing) {
      toast('正在同步中，请稍候', true);
      return;
    }
    state.txSync.preparing = true;
    setTxSyncLock(true);
    try {
      var created = await api('/admin/translation-jobs', {
        method: 'POST',
        body: JSON.stringify({ resource: resource }),
      });
      var jobId = (created.job && created.job.id) || created.id;
      state.txSync.preparing = false;
      setTxSyncLock(false);
      await runTxSyncQueue([{ id: jobId, resource: resource }]);
    } catch (err) {
      toast(err.message || '同步失败', true);
      state.txSync.preparing = false;
      setTxSyncLock(false);
      loadTranslationJobs().catch(function () {});
    }
  }
  async function loadTranslation() {
    if (state.txSync && state.txSync.active) return;
    var status = await api('/admin/translation-status');
    var cfg = await api('/admin/translation-config').catch(function () { return null; });
    var staleItems = collectStaleItems(status.resources);
    var staleLangCount = staleItems.reduce(function (n, it) { return n + it.langs.length; }, 0);
    var overview = $('translation-overview');
    if (overview) {
      var engineLine = '翻译引擎未就绪';
      if (cfg) {
        engineLine = (cfg.hasApiKey
          ? '引擎已就绪（' + (cfg.provider || 'api') + (cfg.model ? ' · ' + cfg.model : '') + '）'
          : '联调模式（未配置 API Key，会写入带 [EN]/[RU] 前缀的占位文案）');
      }
      var title = staleItems.length
        ? '有 ' + staleItems.length + ' 项内容待同步到英文 / 俄文'
        : '英文 / 俄文均已与中文同步';
      var sub = staleItems.length
        ? '共 ' + staleLangCount + ' 个语言版本需要更新。改完中文后点右上角「立即同步」即可。'
        : '继续改中文并保存后，这里会出现待同步项。';
      overview.innerHTML =
        '<div class="tx-hero' + (staleItems.length ? ' is-pending' : ' is-ok') + '">' +
        '<div class="tx-hero-main">' +
        '<p class="tx-hero-kicker">中文为源语言</p>' +
        '<h3 class="tx-hero-title">' + escapeHtml(title) + '</h3>' +
        '<p class="tx-hero-sub">' + escapeHtml(sub) + '</p>' +
        '<p class="tx-hero-meta">' + escapeHtml(engineLine) +
        (status.updatedAt ? ' · 状态更新于 ' + escapeHtml(status.updatedAt) : '') +
        '</p></div>' +
        (staleItems.length
          ? '<button type="button" class="btn btn-accent" id="tx-sync-inline">立即同步</button>'
          : '') +
        '</div>';
      var inline = $('tx-sync-inline');
      if (inline) {
        inline.addEventListener('click', function () {
          if ($('sync-all-stale')) $('sync-all-stale').click();
        });
      }
    }

    var pending = $('translation-pending');
    if (pending) {
      if (!staleItems.length) {
        pending.innerHTML = '<p class="tx-empty">没有待同步内容。英文与俄文官网可直接预览。</p>';
      } else {
        pending.innerHTML =
          '<ul class="tx-pending-list">' +
          staleItems.map(function (it) {
            var chips = it.langs.map(function (l) {
              return '<span class="tx-lang-chip">' + escapeHtml(LANG_LABELS[l] || l) + '</span>';
            }).join('');
            return '<li class="tx-pending-item">' +
              '<div class="tx-pending-main">' +
              '<strong>' + escapeHtml(resourceLabel(it.resource)) + '</strong>' +
              '<span class="tx-pending-key">' + escapeHtml(it.resource) + '</span>' +
              '</div>' +
              '<div class="tx-pending-langs">' + chips + '</div>' +
              '<button type="button" class="btn btn-ghost btn-sm" data-sync-one="' + escapeAttr(it.resource) + '">单独同步</button>' +
              '</li>';
          }).join('') +
          '</ul>';
        pending.querySelectorAll('[data-sync-one]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            syncOneTranslation(btn.getAttribute('data-sync-one')).catch(function (e) {
              toast(e.message || '同步失败', true);
            });
          });
        });
      }
    }

    var rows = Object.keys(status.resources || {}).sort().map(function (resource) {
      var langs = status.resources[resource];
      return '<tr><td><strong>' + escapeHtml(resourceLabel(resource)) + '</strong><br><code class="tx-code">' +
        escapeHtml(resource) + '</code></td>' +
        '<td><span class="badge badge-' + escapeHtml(langs.en) + '">' + escapeHtml(statusLabel(langs.en)) + '</span></td>' +
        '<td><span class="badge badge-' + escapeHtml(langs.ru) + '">' + escapeHtml(statusLabel(langs.ru)) + '</span></td>' +
        '<td class="toolbar">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-res="' + escapeAttr(resource) + '" data-lang="en">标英文已同步</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-res="' + escapeAttr(resource) + '" data-lang="ru">标俄文已同步</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-job-res="' + escapeAttr(resource) + '">建任务</button></td></tr>';
    }).join('');
    if ($('translation-table')) {
      $('translation-table').innerHTML =
        '<table class="data"><thead><tr><th>内容</th><th>英文</th><th>俄文</th><th>手动操作</th></tr></thead><tbody>' +
        rows + '</tbody></table>';
      $('translation-table').querySelectorAll('button[data-res]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          try {
            await api('/admin/translation-status/mark-current', {
              method: 'POST',
              body: JSON.stringify({ resource: btn.getAttribute('data-res'), lang: btn.getAttribute('data-lang') }),
            });
            toast('已标记为同步');
            loadTranslation();
          } catch (err) { toast(err.message, true); }
        });
      });
      $('translation-table').querySelectorAll('button[data-job-res]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          try {
            await api('/admin/translation-jobs', {
              method: 'POST',
              body: JSON.stringify({ resource: btn.getAttribute('data-job-res') }),
            });
            toast('任务已创建（未运行）');
            loadTranslationJobs();
          } catch (err) { toast(err.message, true); }
        });
      });
    }
    await loadTranslationJobs();
  }

  async function loadTranslationJobs() {
    var data = await api('/admin/translation-jobs');
    var jobs = data.jobs || [];
    if (!$('translation-jobs-table')) return;
    if (!jobs.length) {
      $('translation-jobs-table').innerHTML = '<p class="help">暂无任务记录</p>';
      return;
    }
    var rows = jobs.map(function (job) {
      var langs = (job.targetLangs || []).map(function (l) { return LANG_LABELS[l] || l; }).join('、');
      var actions = '';
      if (job.status === 'pending' || job.status === 'failed' || job.status === 'applied' || job.status === 'done') {
        actions += '<button type="button" class="btn btn-accent btn-sm" data-run="' + job.id +
          '" data-run-resource="' + escapeAttr(job.resource) + '">运行</button>';
      }
      if (job.status === 'done') {
        actions += '<button type="button" class="btn btn-ghost btn-sm" data-apply="' + job.id + '">应用</button>';
      }
      var msg = job.result && job.result.message ? job.result.message : (job.error || '—');
      return '<tr><td>#' + job.id + '</td><td><strong>' + escapeHtml(resourceLabel(job.resource)) + '</strong></td>' +
        '<td>' + escapeHtml(langs) + '</td>' +
        '<td><span class="badge badge-' + escapeHtml(job.status) + '">' + escapeHtml(statusLabel(job.status)) + '</span></td>' +
        '<td style="max-width:280px;font-size:12px;color:var(--muted)">' + escapeHtml(msg) + '</td>' +
        '<td class="toolbar">' + actions + '</td></tr>';
    }).join('');
    $('translation-jobs-table').innerHTML =
      '<table class="data"><thead><tr><th>ID</th><th>内容</th><th>目标语言</th><th>状态</th><th>说明</th><th>操作</th></tr></thead><tbody>' +
      rows + '</tbody></table>';
    $('translation-jobs-table').querySelectorAll('[data-run]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        runTxSyncQueue([{
          id: btn.getAttribute('data-run'),
          resource: btn.getAttribute('data-run-resource') || '',
        }]).catch(function (e) { toast(e.message || '运行失败', true); });
      });
    });
    $('translation-jobs-table').querySelectorAll('[data-apply]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          await api('/admin/translation-jobs/' + btn.getAttribute('data-apply') + '/apply', { method: 'POST', body: '{}' });
          toast('已应用并标记同步');
          loadTranslation();
        } catch (err) { toast(err.message, true); }
      });
    });
  }

  async function loadAudit() {
    var action = ($('audit-action') && $('audit-action').value) || '';
    var resource = ($('audit-resource') && $('audit-resource').value) || '';
    var actor = ($('audit-actor') && $('audit-actor').value) || '';
    var q = ($('audit-q') && $('audit-q').value.trim().toLowerCase()) || '';
    var qs = '?limit=150&offset=0';
    if (action) qs += '&action=' + encodeURIComponent(action);
    if (resource) qs += '&resource=' + encodeURIComponent(resource);
    if (actor) qs += '&actor=' + encodeURIComponent(actor);
    var data = await api('/admin/audit-logs' + qs);
    var items = data.items || [];
    state.auditActors = data.actors || [];
    fillAuditActorSelect(actor);

    if (q) {
      items = items.filter(function (row) {
        var blob = [
          row.summary, row.ip, row.resourceId, row.actor, row.action, row.resource,
          row.detail ? JSON.stringify(row.detail) : '',
        ].join(' ').toLowerCase();
        return blob.indexOf(q) !== -1;
      });
    }

    var tbody = $('audit-table') && $('audit-table').querySelector('tbody');
    if (!tbody) return;
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty">暂无匹配的日志</td></tr>';
    } else {
      tbody.innerHTML = items.map(function (row) {
        var badge = row.ok
          ? '<span class="badge badge-ok">成功</span>'
          : '<span class="badge badge-fail">失败</span>';
        var resLabel = auditResourceLabel(row.resource);
        var detailBits = [];
        if (row.detail && typeof row.detail === 'object') {
          if (row.detail.userAgent) detailBits.push('浏览器：' + row.detail.userAgent);
          if (row.detail.error) detailBits.push('错误：' + row.detail.error);
        }
        var title = detailBits.length ? escapeAttr(detailBits.join('\n')) : (row.detail ? escapeAttr(JSON.stringify(row.detail)) : '');
        var actorHtml = '<div class="audit-actor">' +
          '<span class="audit-actor-avatar">' + escapeHtml((row.actor || '?').charAt(0)) + '</span>' +
          '<span>' + escapeHtml(row.actor || '—') + '</span></div>';
        var sourceHtml = '<div class="cell-sub">' + escapeHtml(row.ip || '—') + '</div>';
        if (row.detail && row.detail.userAgent) {
          sourceHtml += '<div class="cell-sub audit-ua" title="' + escapeAttr(row.detail.userAgent) + '">' +
            escapeHtml(shortUa(row.detail.userAgent)) + '</div>';
        }
        return '<tr' + (title ? ' title="' + title + '"' : '') + '>' +
          '<td class="audit-time">' + escapeHtml(formatAuditTime(row.createdAt)) + '</td>' +
          '<td>' + actorHtml + '</td>' +
          '<td><div class="cell-title">' + escapeHtml(auditActionLabel(row.action)) + '</div>' +
          '<div class="cell-sub"><code>' + escapeHtml(row.action || '') + '</code></div></td>' +
          '<td><div class="cell-title">' + escapeHtml(resLabel) + '</div>' +
          (row.resourceId ? '<div class="cell-sub">#' + escapeHtml(row.resourceId) + '</div>' : '') + '</td>' +
          '<td class="audit-summary">' + escapeHtml(row.summary || '—') + '</td>' +
          '<td>' + badge + '</td>' +
          '<td>' + sourceHtml + '</td></tr>';
      }).join('');
    }
    if ($('audit-table-foot')) {
      $('audit-table-foot').textContent =
        '共 ' + (data.total || 0) + ' 条' +
        (q ? ' · 当前筛选显示 ' + items.length + ' 条' : ' · 显示最近 ' + items.length + ' 条') +
        ' · 悬停行可看浏览器等信息';
    }
  }

  function fillAuditActorSelect(selected) {
    var sel = $('audit-actor');
    if (!sel) return;
    var keep = selected || '';
    var opts = ['<option value="">全部操作人</option>'];
    (state.auditActors || []).forEach(function (name) {
      opts.push(
        '<option value="' + escapeAttr(name) + '"' +
        (name === keep ? ' selected' : '') + '>' + escapeHtml(name) + '</option>'
      );
    });
    sel.innerHTML = opts.join('');
  }

  function shortUa(ua) {
    var s = String(ua || '');
    if (/Edg\//.test(s)) return 'Edge';
    if (/Chrome\//.test(s) && !/Edg\//.test(s)) return 'Chrome';
    if (/Firefox\//.test(s)) return 'Firefox';
    if (/Safari\//.test(s) && !/Chrome\//.test(s)) return 'Safari';
    return s.length > 28 ? s.slice(0, 28) + '…' : s;
  }

  /* Bind */
  $('login-btn').addEventListener('click', async function () {
    try {
      var name = ($('actor') && $('actor').value.trim()) || '';
      if (!name) {
        $('login-msg').textContent = '请填写操作人姓名或工号';
        if ($('actor')) $('actor').focus();
        return;
      }
      var password = $('password').value;
      if (!password) {
        $('login-msg').textContent = '请输入密码';
        return;
      }
      var data = await api('/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password: password, actor: name }),
      });
      token = data.token;
      sessionStorage.setItem('txam_admin_token', token);
      setActor(data.actor || name);
      $('login-msg').textContent = '';
      showLogin(false);
      setView('dashboard');
    } catch (err) {
      $('login-msg').className = 'msg err';
      $('login-msg').textContent = err.message === 'admin_disabled'
        ? '后台未启用：请设置 ADMIN_PASSWORD'
        : (err.message || '登录失败');
    }
  });
  if ($('actor')) {
    $('actor').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if ($('password')) $('password').focus();
      }
    });
  }
  $('password').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('login-btn').click(); });
  function logout() {
    token = '';
    sessionStorage.removeItem('txam_admin_token');
    sessionStorage.removeItem('txam_admin_actor');
    actorName = '';
    updateUserChip();
    showLogin(true);
  }
  if ($('sidebar-user-btn')) {
    $('sidebar-user-btn').addEventListener('click', logout);
  }

  document.querySelectorAll('.nav-item').forEach(function (btn) {
    btn.addEventListener('click', function () { setView(btn.getAttribute('data-view')); });
  });
  if ($('global-search')) {
    $('global-search').addEventListener('keydown', function (event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      var query = event.currentTarget.value;
      Promise.resolve(handleGlobalSearch(query)).then(function (result) {
        if (result !== false) event.currentTarget.value = '';
      });
    });
  }
  document.querySelectorAll('.hub-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var hub = btn.closest('.hub-tabs');
      if (!hub) return;
      var key = hub.getAttribute('data-hub');
      var tab = btn.getAttribute('data-hub-tab');
      if (state.hubTabs[key] === 'page' && tab !== 'page' && state.dirtyPages[key]) {
        if (!confirm('“' + (PAGE_LABELS[key] || '当前页面') + '”有尚未保存的更改，确定切换并放弃修改吗？')) return;
        setPageDirty(key, false);
      }
      applyHubTab(key, tab);
      if (tab === 'items') {
        if (key === 'products') loadProducts().catch(function (e) { toast(e.message, true); });
        if (key === 'news') loadNews().catch(function (e) { toast(e.message, true); });
        if (key === 'solutions') loadSolutions().catch(function (e) { toast(e.message, true); });
      } else if (tab === 'page') {
        loadPageForm(key).catch(function (e) { toast(e.message, true); });
      } else if (tab === 'categories' && (key === 'products' || key === 'news' || key === 'solutions')) {
        loadCategories().catch(function (e) { toast(e.message, true); });
      } else if (key === 'system') {
        if (tab === 'translation') loadTranslation().catch(function (e) { toast(e.message, true); });
        if (tab === 'audit') loadAudit().catch(function (e) { toast(e.message, true); });
      }
    });
  });
  document.querySelectorAll('[data-jump]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      setView(btn.getAttribute('data-jump'), {
        hubTab: btn.getAttribute('data-hub-tab') || null,
      });
    });
  });

  if ($('refresh-translation')) {
    $('refresh-translation').addEventListener('click', function () { loadTranslation().catch(function (e) { toast(e.message, true); }); });
  }
  if ($('refresh-jobs')) {
    $('refresh-jobs').addEventListener('click', function () { loadTranslationJobs().catch(function (e) { toast(e.message, true); }); });
  }
  if ($('enqueue-stale-jobs')) {
    $('enqueue-stale-jobs').addEventListener('click', async function () {
      try {
        var result = await api('/admin/translation-jobs', {
          method: 'POST',
          body: JSON.stringify({ enqueueStale: true }),
        });
        toast('已创建 ' + (result.created || 0) + ' 个任务（未运行）');
        loadTranslation();
      } catch (err) { toast(err.message, true); }
    });
  }
  if ($('sync-all-stale')) {
    $('sync-all-stale').addEventListener('click', function () {
      syncAllStaleTranslations().catch(function (e) {
        toast(e.message || '同步失败', true);
      });
    });
  }
  $('refresh-media').addEventListener('click', function () { loadMedia().catch(function (e) { toast(e.message, true); }); });
  if ($('media-search')) {
    $('media-search').addEventListener('input', renderMediaGrid);
  }
  if ($('refresh-audit')) {
    $('refresh-audit').addEventListener('click', function () { loadAudit().catch(function (e) { toast(e.message, true); }); });
  }
  if ($('audit-filter-btn')) {
    $('audit-filter-btn').addEventListener('click', function () { loadAudit().catch(function (e) { toast(e.message, true); }); });
  }
  if ($('audit-filter-reset')) {
    $('audit-filter-reset').addEventListener('click', function () {
      if ($('audit-action')) $('audit-action').value = '';
      if ($('audit-resource')) $('audit-resource').value = '';
      if ($('audit-actor')) $('audit-actor').value = '';
      if ($('audit-q')) $('audit-q').value = '';
      loadAudit().catch(function (e) { toast(e.message, true); });
    });
  }
  ['audit-action', 'audit-resource', 'audit-actor'].forEach(function (id) {
    if ($(id)) {
      $(id).addEventListener('change', function () {
        loadAudit().catch(function (e) { toast(e.message, true); });
      });
    }
  });
  if ($('audit-q')) {
    $('audit-q').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') loadAudit().catch(function (err) { toast(err.message, true); });
    });
  }
  if ($('audit-action')) {
    $('audit-action').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') loadAudit().catch(function (err) { toast(err.message, true); });
    });
  }
  $('media-picker-close').addEventListener('click', closeMediaPicker);
  $('media-picker').addEventListener('click', function (e) {
    if (e.target === $('media-picker')) closeMediaPicker();
  });
  $('product-search').addEventListener('input', function () {
    state.listPages.products = 1;
    renderProductTable();
  });
  $('news-search').addEventListener('input', function () {
    state.listPages.news = 1;
    renderNewsTable();
  });
  $('solution-search').addEventListener('input', function () {
    state.listPages.solutions = 1;
    renderSolutionTable();
  });
  if ($('product-search-btn')) {
    $('product-search-btn').addEventListener('click', function () {
      state.listPages.products = 1;
      renderProductTable();
    });
  }
  if ($('news-search-btn')) {
    $('news-search-btn').addEventListener('click', function () {
      state.listPages.news = 1;
      renderNewsTable();
    });
  }
  if ($('solution-search-btn')) {
    $('solution-search-btn').addEventListener('click', function () {
      state.listPages.solutions = 1;
      renderSolutionTable();
    });
  }

  if ($('drawer-close')) $('drawer-close').addEventListener('click', closeDrawer);
  if ($('drawer-backdrop')) $('drawer-backdrop').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeDrawer();
  });
  $('create-product').addEventListener('click', function () {
    createProduct().catch(function (e) { toast(e.message, true); });
  });
  $('create-news').addEventListener('click', function () {
    createNews().catch(function (e) { toast(e.message, true); });
  });
  $('create-solution').addEventListener('click', function () {
    try { createSolution(); } catch (e) { toast(e.message, true); }
  });

  if ($('add-product-cat')) {
    $('add-product-cat').addEventListener('click', function () { editProductCategory(null); });
  }
  if ($('add-solution-cat')) {
    $('add-solution-cat').addEventListener('click', function () { editSolutionCategory(null); });
  }
  if ($('add-news-cat')) {
    $('add-news-cat').addEventListener('click', function () { editNewsCategory(null); });
  }
  $('save-page-home').addEventListener('click', function () { savePage('home'); });
  $('save-page-about').addEventListener('click', function () { savePage('about'); });
  $('save-page-contact').addEventListener('click', function () { savePage('contact'); });
  $('save-page-products').addEventListener('click', function () { savePage('products'); });
  $('save-page-news').addEventListener('click', function () { savePage('news'); });
  $('save-page-solutions').addEventListener('click', function () { savePage('solutions'); });
  $('save-site').addEventListener('click', function () { saveSite(); });
  $('media-file').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    uploadMedia(file).catch(function (err) { toast(err.message, true); });
    e.target.value = '';
  });

  bindDashboardScrollSync();
  bindListStatusTabs();

  if (token) {
    updateUserChip();
    showLogin(false);
    setView('dashboard');
  } else {
    showLogin(true);
  }
})();
