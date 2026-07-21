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
    pageCache: {},
    siteCache: null,
    auditActors: [],
    hubTabs: { products: 'items', news: 'items', solutions: 'items' },
    sectionTabs: {},
  };

  var $ = function (id) { return document.getElementById(id); };

  function toast(text, isErr) {
    var el = $('toast');
    el.textContent = text;
    el.className = 'toast show' + (isErr ? ' err' : '');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2800);
  }

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
  }

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
        (isVacate ? '请选择一条已发布内容顶替首页坑位后再下架。' : '该类精选已满，请选择要让出的一项。');
      confirmBtn.textContent = isVacate ? '用选中项顶替并继续' : '让出选中项并精选当前';
      list.innerHTML = items.map(function (o) {
        var label = o.name || o.title || ('#' + o.id);
        var img = o.image || o.cover || '';
        return '<label class="slot-replace-item" data-id="' + escapeAttr(o.id) + '">' +
          '<input type="radio" name="slot-replace" value="' + escapeAttr(o.id) + '">' +
          (img ? '<img src="' + escapeHtml(assetUrl(img)) + '" alt="">' : '') +
          '<span><strong>' + escapeHtml(label) + '</strong><br><span class="help">ID ' + escapeHtml(o.id) + '</span></span>' +
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
  };
  var VIEW_BY_LEGACY = {
    products: 'page-products',
    news: 'page-news',
    solutions: 'page-solutions',
  };

  function applyHubTab(hub, tab) {
    if (!hub) return;
    if (tab) state.hubTabs[hub] = tab;
    var current = state.hubTabs[hub] || 'items';
    document.querySelectorAll('.hub-tabs[data-hub="' + hub + '"] .hub-tab').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-hub-tab') === current);
    });
    document.querySelectorAll('.hub-panel[data-hub="' + hub + '"]').forEach(function (panel) {
      panel.classList.toggle('hidden', panel.getAttribute('data-hub-panel') !== current);
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
      await Promise.all([loadPageForm('products'), loadProducts()]);
    } else if (hub === 'news') {
      await Promise.all([loadPageForm('news'), loadNews()]);
    } else if (hub === 'solutions') {
      await Promise.all([loadPageForm('solutions'), loadSolutions()]);
    }
    updateHubCount(hub);
  }

  function setView(name, opts) {
    opts = opts || {};
    var preferredTab = opts.hubTab || null;
    if (VIEW_BY_LEGACY[name]) {
      preferredTab = preferredTab || 'items';
      name = VIEW_BY_LEGACY[name];
    }
    state.view = name;
    closeDrawer();
    document.querySelectorAll('.nav-item').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-view') === name);
    });
    document.querySelectorAll('.view').forEach(function (sec) {
      sec.classList.toggle('hidden', sec.id !== 'view-' + name);
    });
    var activeNav = document.querySelector('.nav-item[data-view="' + name + '"]');
    if (activeNav) {
      var group = activeNav.closest('.nav-group');
      if (group) {
        group.classList.remove('is-collapsed');
        var toggle = group.querySelector('.nav-group-toggle');
        if (toggle) toggle.setAttribute('aria-expanded', 'true');
      }
    }
    var hub = HUB_BY_VIEW[name];
    if (hub) {
      return Promise.resolve(loadHub(hub, preferredTab)).catch(function (e) { toast(e.message, true); });
    }
    var loaders = {
      dashboard: loadDashboard,
      'page-home': function () { return loadPageForm('home'); },
      'page-about': function () { return loadPageForm('about'); },
      'page-contact': function () { return loadPageForm('contact'); },
      site: loadSiteForm,
      categories: loadCategories,
      media: loadMedia,
      translation: loadTranslation,
      audit: loadAudit,
    };
    if (loaders[name]) {
      return Promise.resolve(loaders[name]()).catch(function (e) { toast(e.message, true); });
    }
    return Promise.resolve();
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

  /** Section tabs for long page forms. sections: [{ key, label, html }] */
  function buildSectionTabs(formRootId, sections, defaultKey) {
    defaultKey = defaultKey || (sections[0] && sections[0].key) || '';
    var remembered = (state.sectionTabs && state.sectionTabs[formRootId]) || defaultKey;
    if (!sections.some(function (s) { return s.key === remembered; })) remembered = defaultKey;
    if (!state.sectionTabs) state.sectionTabs = {};
    state.sectionTabs[formRootId] = remembered;
    var tabsHtml =
      '<div class="hub-tabs section-tabs" data-section-root="' + escapeAttr(formRootId) + '" role="tablist">' +
      sections.map(function (s) {
        return '<button type="button" class="hub-tab' + (s.key === remembered ? ' is-active' : '') +
          '" data-section-tab="' + escapeAttr(s.key) + '" role="tab">' + escapeHtml(s.label) + '</button>';
      }).join('') +
      '</div>';
    var panelsHtml = sections.map(function (s) {
      return '<div class="section-panel' + (s.key === remembered ? '' : ' hidden') +
        '" data-section-panel="' + escapeAttr(s.key) + '">' + s.html + '</div>';
    }).join('');
    return tabsHtml + panelsHtml;
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
        t.classList.toggle('is-active', t.getAttribute('data-section-tab') === key);
      });
      root.querySelectorAll(':scope > .section-panel').forEach(function (p) {
        var show = p.getAttribute('data-section-panel') === key;
        p.classList.toggle('hidden', !show);
        if (show) flushRichEditorsInPanel(p);
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
      items.map(function (item) {
        return '<div class="repeater-row">' +
          '<div class="form-grid">' +
          '<div class="field"><label>步骤</label><input class="rep-step" type="text" value="' + escapeAttr(item.step || '') + '"></div>' +
          '<div class="field"><label>标题</label><input class="rep-title" type="text" value="' + escapeAttr(item.title || '') + '"></div>' +
          '<div class="field full"><label>说明</label><textarea class="rep-desc">' + escapeHtml(item.desc || '') + '</textarea></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-process">＋ 添加步骤</button></div>';
  }

  function bindProcessRepeater() {
    var root = $('rep-process');
    if (!root) return;
    root.addEventListener('click', function (e) {
      var t = e.target;
      if (t.classList.contains('rep-add-process')) {
        var row = document.createElement('div');
        row.className = 'repeater-row';
        row.innerHTML =
          '<div class="form-grid">' +
          '<div class="field"><label>步骤</label><input class="rep-step" type="text" value=""></div>' +
          '<div class="field"><label>标题</label><input class="rep-title" type="text" value=""></div>' +
          '<div class="field full"><label>说明</label><textarea class="rep-desc"></textarea></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';
        root.insertBefore(row, t);
      }
      if (t.classList.contains('rep-remove')) {
        var r = t.closest('.repeater-row');
        if (r && root.querySelectorAll('.repeater-row').length > 1) r.remove();
      }
    });
  }

  function collectProcessRepeater() {
    var root = $('rep-process');
    if (!root) return [];
    return Array.prototype.map.call(root.querySelectorAll('.repeater-row'), function (row) {
      return {
        step: (row.querySelector('.rep-step') || {}).value || '',
        title: (row.querySelector('.rep-title') || {}).value || '',
        desc: (row.querySelector('.rep-desc') || {}).value || '',
      };
    }).filter(function (x) { return x.step || x.title || x.desc; });
  }

  function statsRowsHtml(items) {
    items = items && items.length ? items : [{ value: '', unit: '', label: '' }];
    return '<div class="repeater" id="rep-stats">' +
      items.map(function (item) {
        return '<div class="repeater-row"><div class="form-grid">' +
          '<div class="field"><label>数值</label><input class="st-value" type="text" value="' + escapeAttr(item.value || '') + '"></div>' +
          '<div class="field"><label>单位</label><input class="st-unit" type="text" value="' + escapeAttr(item.unit || '') + '"></div>' +
          '<div class="field full"><label>说明</label><input class="st-label" type="text" value="' + escapeAttr(item.label || '') + '"></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-stats">＋ 添加统计</button></div>';
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
            input.dispatchEvent(new Event('input'));
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
    ]);
    state.products = results[0].items || [];
    state.news = results[1].items || [];
    state.solutions = results[2].items || [];
    var status = results[3];
    var stale = 0;
    Object.keys(status.resources || {}).forEach(function (key) {
      var r = status.resources[key];
      if (r.en === 'stale') stale++;
      if (r.ru === 'stale') stale++;
    });
    var pubProducts = state.products.filter(function (p) { return p.published !== false; }).length;
    var pubNews = state.news.filter(function (n) { return n.published !== false; }).length;
    var pubSolutions = state.solutions.filter(function (s) { return s.published !== false; }).length;
    if ($('dash-date')) {
      var now = new Date();
      $('dash-date').textContent =
        now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日 · 中文为源语言';
    }
    $('dash-stats').innerHTML =
      stat('产品数量', state.products.length, '已发布 ' + pubProducts + ' 条') +
      stat('解决方案', state.solutions.length, '已发布 ' + pubSolutions + ' 条') +
      stat('新闻文章', state.news.length, '已发布 ' + pubNews + ' 条') +
      stat('待同步翻译', stale, stale ? '请到「翻译同步」处理' : 'en / ru 均已最新', stale > 0);
    if ($('dash-content-status')) {
      $('dash-content-status').innerHTML =
        '<table class="status-table"><thead><tr><th>模块</th><th>数量</th><th>说明</th></tr></thead><tbody>' +
        '<tr><td>产品</td><td>' + state.products.length + '</td><td>产品中心列表</td></tr>' +
        '<tr><td>解决方案</td><td>' + state.solutions.length + '</td><td>行业落地页</td></tr>' +
        '<tr><td>新闻</td><td>' + state.news.length + '</td><td>新闻中心</td></tr>' +
        '<tr><td>翻译</td><td>' + stale + '</td><td>' + (stale ? '有待同步语言' : '状态正常') + '</td></tr>' +
        '</tbody></table>';
    }
  }

  function stat(label, value, hint, warn) {
    return '<div class="stat-card' + (warn ? ' warn' : '') + '"><div class="label">' + escapeHtml(label) +
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

  function openDrawer(kind, title) {
    var drawer = $('editor-drawer');
    if (!drawer) return;
    destroyRichEditors();
    drawer.classList.remove('hidden');
    drawer.setAttribute('aria-hidden', 'false');
    if ($('drawer-title')) $('drawer-title').textContent = title || '编辑';
    ['product-editor', 'news-editor', 'solution-editor'].forEach(function (id) {
      if ($(id)) $(id).classList.toggle('hidden', id !== kind + '-editor');
    });
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
    var statusFilter = $('product-filter-status') ? $('product-filter-status').value : 'all';
    if (statusFilter === 'published') rows = rows.filter(function (r) { return r.published !== false; });
    if (statusFilter === 'draft') rows = rows.filter(function (r) { return r.published === false; });
    list.innerHTML = rows.map(function (p) {
      var meta = [p.category, p.model, 'ID ' + p.id].filter(Boolean).join(' · ');
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
    if ($('product-table-foot')) $('product-table-foot').textContent = '共 ' + rows.length + ' 条';
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
      '<p class="field-help">在「全站 → 分类」里维护可选分类</p></div>';
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
      '<p class="field-help">在「全站 → 分类」里维护可选分类</p></div>';
  }

  async function ensureCategoriesLoaded() {
    if (state.productCategories.length && state.newsCategories.length) return;
    var data = await api('/admin/categories');
    state.productCategories = data.products || [];
    state.newsCategories = data.news || [];
  }

  async function loadCategories() {
    var data = await api('/admin/categories');
    state.productCategories = data.products || [];
    state.newsCategories = data.news || [];
    renderProductCatList();
    renderNewsCatList();
  }

  function renderProductCatList() {
    var root = $('product-cat-list');
    if (!root) return;
    var items = state.productCategories;
    if (!items.length) {
      root.innerHTML = '<p class="empty">暂无产品分类</p>';
      return;
    }
    root.innerHTML = items.map(function (c) {
      return '<div class="item-row" style="cursor:default">' +
        '<div class="item-main">' +
        '<div class="item-title-row"><span class="item-title">' + escapeHtml(c.name) + '</span></div>' +
        '<div class="item-meta">键 ' + escapeHtml(c.key) +
        (c.filterKeyEn ? ' · 英筛 ' + escapeHtml(c.filterKeyEn) : '') +
        ' · 排序 ' + escapeHtml(String(c.sortOrder)) + '</div></div>' +
        '<div class="item-actions">' +
        '<button type="button" class="btn-edit" data-edit-pc="' + escapeAttr(c.key) + '">编辑</button>' +
        '<button type="button" class="btn btn-ghost btn-sm btn-danger-text" data-del-pc="' + escapeAttr(c.key) + '">删除</button>' +
        '</div></div>';
    }).join('');
    root.querySelectorAll('[data-edit-pc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-edit-pc');
        var cat = state.productCategories.find(function (c) { return c.key === key; });
        if (cat) editProductCategory(cat);
      });
    });
    root.querySelectorAll('[data-del-pc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteProductCategory(btn.getAttribute('data-del-pc'));
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
    root.innerHTML = items.map(function (c) {
      return '<div class="item-row" style="cursor:default">' +
        '<div class="item-main">' +
        '<div class="item-title-row"><span class="item-title">' + escapeHtml(c.name) + '</span></div>' +
        '<div class="item-meta">键 ' + escapeHtml(c.key) + ' · 排序 ' + escapeHtml(String(c.sortOrder)) + '</div></div>' +
        '<div class="item-actions">' +
        '<button type="button" class="btn-edit" data-edit-nc="' + escapeAttr(c.key) + '">编辑</button>' +
        '<button type="button" class="btn btn-ghost btn-sm btn-danger-text" data-del-nc="' + escapeAttr(c.key) + '">删除</button>' +
        '</div></div>';
    }).join('');
    root.querySelectorAll('[data-edit-nc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-edit-nc');
        var cat = state.newsCategories.find(function (c) { return c.key === key; });
        if (cat) editNewsCategory(cat);
      });
    });
    root.querySelectorAll('[data-del-nc]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        deleteNewsCategoryUi(btn.getAttribute('data-del-nc'));
      });
    });
  }

  function editProductCategory(cat) {
    var name = prompt('分类名称（中文）', cat ? cat.name : '');
    if (name == null) return;
    name = name.trim();
    if (!name) { toast('名称不能为空', true); return; }
    var isNew = !cat;
    var key = cat ? cat.key : prompt('分类键（英文小写，如 optical）', '');
    if (key == null) return;
    key = String(key).trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(key)) {
      toast('分类键格式不对，请用英文小写字母开头', true);
      return;
    }
    var sortOrder = cat ? cat.sortOrder : 100;
    var sortRaw = prompt('排序（数字越小越靠前）', String(sortOrder));
    if (sortRaw == null) return;
    var payload = {
      key: key,
      name: name,
      nameEn: cat ? cat.nameEn : '',
      filterKeyEn: cat ? cat.filterKeyEn : key,
      sortOrder: Number(sortRaw) || 0,
    };
    var req = isNew
      ? api('/admin/categories/products', { method: 'POST', body: JSON.stringify(payload) })
      : api('/admin/categories/products/' + encodeURIComponent(key), {
        method: 'PUT', body: JSON.stringify(payload),
      });
    req.then(function () {
      toast(isNew ? '产品分类已创建' : '产品分类已保存');
      return loadCategories();
    }).catch(function (e) { toast(e.message, true); });
  }

  function editNewsCategory(cat) {
    var name = prompt('分类名称', cat ? cat.name : '');
    if (name == null) return;
    name = name.trim();
    if (!name) { toast('名称不能为空', true); return; }
    var isNew = !cat;
    var key = cat ? cat.key : prompt('分类键（英文小写，如 company）', '');
    if (key == null) return;
    key = String(key).trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{0,31}$/.test(key)) {
      toast('分类键格式不对', true);
      return;
    }
    var sortRaw = prompt('排序（数字越小越靠前）', String(cat ? cat.sortOrder : 100));
    if (sortRaw == null) return;
    var payload = { key: key, name: name, sortOrder: Number(sortRaw) || 0 };
    var req = isNew
      ? api('/admin/categories/news', { method: 'POST', body: JSON.stringify(payload) })
      : api('/admin/categories/news/' + encodeURIComponent(key), {
        method: 'PUT', body: JSON.stringify(payload),
      });
    req.then(function () {
      toast(isNew ? '新闻分类已创建' : '新闻分类已保存');
      return loadCategories();
    }).catch(function (e) { toast(e.message, true); });
  }

  function deleteProductCategory(key) {
    if (!confirm('删除产品分类「' + key + '」？若仍有产品使用该分类会失败。')) return;
    api('/admin/categories/products/' + encodeURIComponent(key), { method: 'DELETE' })
      .then(function () { toast('已删除'); return loadCategories(); })
      .catch(function (e) {
        toast(e.message === 'category_in_use' ? '仍有产品在用此分类，无法删除' : e.message, true);
      });
  }

  function deleteNewsCategoryUi(key) {
    if (!confirm('删除新闻分类「' + key + '」？若仍有新闻使用会失败。')) return;
    api('/admin/categories/news/' + encodeURIComponent(key), { method: 'DELETE' })
      .then(function () { toast('已删除'); return loadCategories(); })
      .catch(function (e) {
        toast(e.message === 'category_in_use' ? '仍有新闻在用此分类，无法删除' : e.message, true);
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
    openDrawer('product', isNew ? '新建产品' : '编辑产品');
    var toolbarTop = isNew
      ? '<p class="field-help" style="margin-bottom:14px">填写后点「保存」才会真正创建；关闭窗口不会保存。</p>'
      : '<div class="toolbar" style="margin-bottom:14px">' +
        previewLink('/product-detail.html?id=' + encodeURIComponent(item.id), '预览详情页') + '</div>';
    var actions =
      '<div class="toolbar" style="margin-top:16px">' +
      '<button type="button" class="btn btn-accent" id="save-product">保存</button>' +
      (isNew
        ? '<button type="button" class="btn btn-ghost" id="cancel-product">取消</button>'
        : '<button type="button" class="btn btn-ghost" id="reload-product">重新加载</button>' +
          (item.published
            ? '<button type="button" class="btn btn-ghost btn-danger-text" id="unpublish-product">下架</button>'
            : '') +
          '<button type="button" class="btn btn-ghost btn-danger-text" id="delete-product">删除</button>') +
      '</div>';
    $('product-editor').innerHTML =
      toolbarTop +
      '<div class="form-grid">' +
      '<p class="form-section-title">基本信息</p>' +
      field('name', '产品名称', item.name) + field('model', '型号', item.model) +
      productCategorySelect(item) +
      imageField('image', '封面图', item.image) +
      field('specs', '规格亮点（每行一条）', (item.specs || []).join('\n'), 'full', 'textarea') +
      field('summary', '一句话介绍', item.summary, 'full', 'textarea') +
      richTextField('contentHtml', '产品详情', item.contentHtml, '用工具栏排版即可，不必手写代码') +
      publishedCheck('p-published', !!item.published) +
      '<div class="field full"><p class="field-help">新建默认未发布。下架后官网不展示；可用「下架」按钮或取消勾选「已发布」后保存。</p></div>' +
      '<div class="field full"><label class="check"><input type="checkbox" id="p-showInList"' +
      (item.showInList !== false ? ' checked' : '') + '> 在产品中心列表显示</label></div>' +
      advancedBlock(
        field('sortOrder', '列表排序（数字越小越靠前）', item.sortOrder != null ? item.sortOrder : 0)
      ) +
      '</div>' + actions;
    bindImageFields($('product-editor'));
    initRichEditors(['f-contentHtml']);
    $('save-product').onclick = function () { saveProduct().catch(function (e) { toast(e.message, true); }); };
    if (isNew) {
      $('cancel-product').onclick = function () {
        state.isNewProduct = false;
        state.selectedProductId = null;
        closeDrawer();
        renderProductTable();
      };
    } else {
      $('reload-product').onclick = function () { openProduct(item.id); };
      if ($('unpublish-product')) {
        $('unpublish-product').onclick = function () {
          unpublishCatalog('products', item.id).catch(function (e) { toast(e.message, true); });
        };
      }
      $('delete-product').onclick = function () { deleteCatalog('products', item.id); };
    }
  }

  async function saveProduct() {
    var name = val('f-name').trim();
    if (!name) {
      toast('请填写产品名称', true);
      return;
    }
    var categoryKey = val('f-categoryKey');
    if (!categoryKey) {
      toast('请选择产品分类', true);
      return;
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
      return;
    }
    body.id = String(state.selectedProductId);
    await api('/admin/products/' + encodeURIComponent(state.selectedProductId), {
      method: 'PUT', body: JSON.stringify(body),
    });
    toast('产品已保存');
    await loadProducts();
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
    list.innerHTML = rows.map(function (n) {
      var meta = [n.category, n.date, 'ID ' + n.id].filter(Boolean).join(' · ');
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
    if ($('news-table-foot')) $('news-table-foot').textContent = '共 ' + rows.length + ' 条';
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
    openDrawer('news', isNew ? '新建新闻' : '编辑新闻');
    var toolbarTop = isNew
      ? '<p class="field-help" style="margin-bottom:14px">填写后点「保存」才会真正创建；关闭窗口不会保存。</p>'
      : '<div class="toolbar" style="margin-bottom:14px">' +
        previewLink('/news-detail.html?id=' + encodeURIComponent(item.id), '预览详情页') + '</div>';
    var actions =
      '<div class="toolbar" style="margin-top:16px">' +
      '<button type="button" class="btn btn-accent" id="save-news">保存</button>' +
      (isNew
        ? '<button type="button" class="btn btn-ghost" id="cancel-news">取消</button>'
        : '<button type="button" class="btn btn-ghost" id="reload-news">重新加载</button>' +
          (item.published
            ? '<button type="button" class="btn btn-ghost btn-danger-text" id="unpublish-news">下架</button>'
            : '') +
          '<button type="button" class="btn btn-ghost btn-danger-text" id="delete-news">删除</button>') +
      '</div>';
    $('news-editor').innerHTML =
      toolbarTop +
      '<div class="form-grid">' +
      '<p class="form-section-title">基本信息</p>' +
      field('title', '新闻标题', item.title, 'full') +
      newsCategorySelect(item) +
      field('date', '发布日期', item.date) +
      imageField('cover', '封面图', item.cover) +
      richTextField('contentHtml', '新闻正文', item.contentHtml, '用工具栏排版即可，不必手写代码') +
      publishedCheck('n-published', !!item.published) +
      '<div class="field full check-row"><input type="checkbox" id="n-home-featured"' + (item.homeFeatured ? ' checked' : '') + '>' +
      '<label for="n-home-featured" style="text-transform:none;letter-spacing:0;font-size:14px;color:var(--txam-dark)">精选新闻（首页固定 2 条，默认不精选）</label></div>' +
      '<div class="field full"><p class="field-help">首页精选新闻为必填坑位。下架或取消精选时，若当前占用坑位，必须指定另一条已发布新闻替代。</p></div>' +
      advancedBlock(
        field('sortOrder', '列表排序', item.sortOrder != null ? item.sortOrder : 0)
      ) +
      '</div>' + actions;
    bindImageFields($('news-editor'));
    initRichEditors(['f-contentHtml']);
    $('save-news').onclick = function () { saveNews().catch(function (e) { toast(e.message, true); }); };
    if (isNew) {
      $('cancel-news').onclick = function () {
        state.isNewNews = false;
        state.selectedNewsId = null;
        closeDrawer();
        renderNewsTable();
      };
    } else {
      $('reload-news').onclick = function () { openNews(item.id); };
      if ($('unpublish-news')) {
        $('unpublish-news').onclick = function () {
          unpublishCatalog('news', item.id).catch(function (e) { toast(e.message, true); });
        };
      }
      $('delete-news').onclick = function () { deleteCatalog('news', item.id); };
    }
  }

  async function saveNews() {
    var title = val('f-title').trim();
    if (!title) {
      toast('请填写新闻标题', true);
      return;
    }
    var category = val('f-category');
    if (!category) {
      toast('请选择新闻分类', true);
      return;
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
      return;
    }
    body.id = String(state.selectedNewsId);
    await saveWithSlotRetry('/admin/news/' + encodeURIComponent(state.selectedNewsId), body, 'PUT');
    toast('新闻已保存');
    await loadNews();
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
    list.innerHTML = rows.map(function (s) {
      var slotLabel = s.homeSlot === 'hero' ? '标杆方案' : s.homeSlot === 'category' ? '精选方案' : '';
      var meta = [s.category, s.slug ? ('落地页 ' + s.slug) : null, 'ID ' + s.id].filter(Boolean).join(' · ');
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
    if ($('solution-table-foot')) $('solution-table-foot').textContent = '共 ' + rows.length + ' 条';
  }

  async function openSolution(id) {
    state.isNewSolution = false;
    state.selectedSolutionId = id;
    renderSolutionTable();
    var item = await api('/admin/solutions/' + encodeURIComponent(id));
    fillSolutionForm(item, false);
  }

  function blankSolution() {
    return {
      name: '', category: '解决方案', image: '', specs: [], summary: '',
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
    return '<div class="field"><label>对应官网落地页</label><select id="f-slug">' +
      '<option value="">（通用详情页，不绑固定落地页）</option>' +
      slugOpts.map(function (s) {
        return '<option value="' + s + '"' + (item.slug === s ? ' selected' : '') + '>' +
          escapeHtml((slugLabels[s] || s) + ' · ' + s + '-solution.html') + '</option>';
      }).join('') +
      '</select></div>';
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
    return '<div class="card home-slot-card" style="margin-top:12px">' +
      '<h3 class="card-title">首页展示位置（可选）</h3>' +
      '<p class="field-help">新建默认不进首页，只出现在落地页/列表。需要时再选下面其中一个位置（互斥）。首页标杆与精选为必填坑位，取消或下架时须指定替代。</p>' +
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
    openDrawer('solution', isNew ? '新建方案' : '编辑方案');
    var toolbarTop = isNew
      ? '<p class="field-help" style="margin-bottom:14px">填写后点「保存」才会真正创建；关闭窗口不会保存。新建默认不上首页。</p>'
      : '';
    var actions =
      '<div class="toolbar" style="margin-top:16px">' +
      '<button type="button" class="btn btn-accent" id="save-solution">保存</button>' +
      (isNew
        ? '<button type="button" class="btn btn-ghost" id="cancel-solution">取消</button>'
        : '<button type="button" class="btn btn-ghost" id="reload-solution">重新加载</button>' +
          (item.published
            ? '<button type="button" class="btn btn-ghost btn-danger-text" id="unpublish-solution">下架</button>'
            : '') +
          '<button type="button" class="btn btn-ghost btn-danger-text" id="delete-solution">删除</button>') +
      '</div>';
    $('solution-editor').innerHTML =
      toolbarTop +
      '<div class="form-grid">' +
      '<p class="form-section-title">基本信息</p>' +
      field('name', '方案名称', item.name, 'full') +
      field('category', '分类名称', item.category) +
      solutionSlugSelect(item) +
      imageField('image', '封面图', item.image) +
      field('specs', '亮点标签（每行一条）', (item.specs || []).join('\n'), 'full', 'textarea') +
      field('summary', '一句话介绍', item.summary, 'full', 'textarea') +
      '</div>' +
      solutionHomeSlotBlock(item) +
      '<div class="form-grid" style="margin-top:12px">' +
      richTextField('contentHtml', '方案详情', item.contentHtml, '用工具栏排版即可，不必手写代码') +
      '</div>' +
      '<div class="card" style="margin-top:12px">' +
      '<h3 class="card-title">客户痛点</h3>' +
      '<p class="field-help">用普通文字填写即可，例如「大尺寸装配难」</p>' +
      pairRowsHtml('pain', item.painPoints || [], '痛点标题', '痛点说明') + '</div>' +
      '<div class="card" style="margin-top:12px">' +
      '<h3 class="card-title">工艺流程</h3>' +
      '<p class="field-help">按步骤写清「做什么」，不用写代码</p>' +
      processRowsHtml(item.process || []) + '</div>' +
      '<div class="form-grid" style="margin-top:12px">' +
      advancedBlock(field('sortOrder', '列表排序', item.sortOrder != null ? item.sortOrder : 0)) +
      '</div>' + actions;
    bindImageFields($('solution-editor'));
    bindPairRepeater('pain');
    bindProcessRepeater();
    initRichEditors(['f-contentHtml']);
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
    $('save-solution').onclick = function () { saveSolution().catch(function (e) { toast(e.message, true); }); };
    if (isNew) {
      $('cancel-solution').onclick = function () {
        state.isNewSolution = false;
        state.selectedSolutionId = null;
        closeDrawer();
        renderSolutionTable();
      };
    } else {
      $('reload-solution').onclick = function () { openSolution(item.id); };
      if ($('unpublish-solution')) {
        $('unpublish-solution').onclick = function () {
          unpublishCatalog('solutions', item.id).catch(function (e) { toast(e.message, true); });
        };
      }
      $('delete-solution').onclick = function () { deleteCatalog('solutions', item.id); };
    }
  }

  async function saveSolution() {
    var name = val('f-name').trim();
    if (!name) {
      toast('请填写方案名称', true);
      return;
    }
    var slotEl = document.querySelector('#solution-home-slot input[name="homeSlot"]:checked');
    var body = {
      name: name, category: val('f-category'), image: val('f-image'),
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
      return;
    }
    body.id = String(state.selectedSolutionId);
    await saveWithSlotRetry('/admin/solutions/' + encodeURIComponent(state.selectedSolutionId), body, 'PUT');
    toast('方案已保存');
    await loadSolutions();
  }

  function createSolution() {
    state.isNewSolution = true;
    state.selectedSolutionId = null;
    renderSolutionTable();
    fillSolutionForm(blankSolution(), true);
  }

  async function deleteCatalog(kind, id) {
    if (!confirm('确认删除 ' + kind + ' #' + id + '？此操作不可撤销。')) return;
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
    toast('已删除 #' + id);
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
            input.dispatchEvent(new Event('input'));
          }
        });
      });
    });
  }

  function seoBlock(page) {
    return cardBlock('SEO',
      field('seo-title', '标题', (page.seo || {}).title, 'full') +
      field('seo-desc', '描述', (page.seo || {}).description, 'full', 'textarea') +
      imageField('seo-image', 'OG 图片', (page.seo || {}).image || ''));
  }

  function collectSeo() {
    return { title: val('f-seo-title'), description: val('f-seo-desc'), image: val('f-seo-image') };
  }

  function collectStatsFrom(rootId, prevItems) {
    var root = $(rootId);
    if (!root) return [];
    prevItems = prevItems || [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row, i) {
      var item = {
        value: (row.querySelector('.st-value') || {}).value || '',
        unit: (row.querySelector('.st-unit') || {}).value || '',
        label: (row.querySelector('.st-label') || {}).value || '',
      };
      if (prevItems[i] && prevItems[i].emphasis) item.emphasis = prevItems[i].emphasis;
      return item;
    }).filter(function (x) { return x.value || x.label; });
  }

  /* ——— Home service steps / contact channels / about repeaters ——— */
  var HOME_STEP_BLANK =
    '<div class="form-grid">' +
    '<div class="field"><label>序号</label><input class="hs-badge" type="text"></div>' +
    '<div class="field"><label>样式</label><select class="hs-style">' +
    '<option value="start">start</option><option value="mid" selected>mid</option><option value="accent">accent</option></select></div>' +
    '<div class="field full"><label>标题</label><input class="hs-title" type="text"></div>' +
    '<div class="field full"><label>要点（每行一条）</label><textarea class="hs-items"></textarea></div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';

  var CHANNEL_BLANK =
    '<div class="form-grid">' +
    '<div class="field"><label>类型</label><input class="ch-type" type="text" value="phone"></div>' +
    '<div class="field"><label>图标</label><input class="ch-icon" type="text"></div>' +
    '<div class="field"><label>标题</label><input class="ch-title" type="text"></div>' +
    '<div class="field"><label>显示值</label><input class="ch-value" type="text"></div>' +
    '<div class="field"><label>眉题</label><input class="ch-eyebrow" type="text"></div>' +
    '<div class="field"><label>提示</label><input class="ch-hint" type="text"></div>' +
    '<div class="field full"><label>链接</label><input class="ch-href" type="text"></div>' +
    '<div class="field"><label>打开方式</label><select class="ch-target"><option value="_self">当前页</option><option value="_blank">新窗口</option></select></div>' +
    '<div class="field"><label>占列</label><input class="ch-col" type="text" value="1"></div>' +
    '<div class="field"><label>悬停样式</label><input class="ch-hover" type="text" value="dark"></div>' +
    '<div class="field full"><label>按钮文案（可选）</label><input class="ch-cta" type="text"></div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';

  var PILLAR_BLANK =
    '<div class="form-grid"><div class="field full"><label>标题</label><input class="pl-title" type="text"></div>' +
    '<div class="field full"><label>说明</label><textarea class="pl-body"></textarea></div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';

  var CULTURE_PILLAR_BLANK =
    '<div class="form-grid"><div class="field full"><label>标题</label><input class="cp-title" type="text"></div>' +
    '<div class="field full"><label>正文 HTML</label><textarea class="cp-body"></textarea></div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';

  var CLIENT_BLANK =
    '<div class="form-grid">' +
    '<div class="field full image-field"><label>Logo</label><div class="image-field-row">' +
    '<input class="cl-image" type="text"><button type="button" class="btn btn-ghost btn-sm" data-pick-inline>从媒体库选图</button></div></div>' +
    '<div class="field full"><label>说明 / Alt</label><input class="cl-alt" type="text"></div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';

  var CAROUSEL_SLIDE_BLANK =
    '<div class="form-grid">' +
    '<div class="field full image-field"><label>图片</label><div class="image-field-row">' +
    '<input class="cs-image" type="text"><button type="button" class="btn btn-ghost btn-sm" data-pick-inline>从媒体库选图</button></div></div>' +
    '<div class="field"><label>标题</label><input class="cs-title" type="text"></div>' +
    '<div class="field"><label>标签</label><input class="cs-tag" type="text"></div>' +
    '<div class="field full"><label>描述</label><input class="cs-desc" type="text"></div>' +
    '<div class="field full"><label>图片说明</label><input class="cs-alt" type="text"></div>' +
    '<div class="field"><label>圆点文案</label><input class="cs-dot" type="text"></div>' +
    '<div class="field"><label>圆点无障碍</label><input class="cs-dotAria" type="text"></div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';

  var TIMELINE_BLANK =
    '<div class="form-grid">' +
    '<div class="field"><label>年份</label><input class="tl-year" type="text"></div>' +
    '<div class="field"><label>侧边</label><select class="tl-side"><option value="left">左</option><option value="right">右</option></select></div>' +
    '<div class="field"><label>强调</label><select class="tl-accent"><option value="false">否</option><option value="true">是</option></select></div>' +
    '<div class="field"><label>年份强调</label><select class="tl-yearAccent"><option value="false">否</option><option value="true">是</option></select></div>' +
    '<div class="field full"><label>导语 HTML（可选）</label><textarea class="tl-lead"></textarea></div>' +
    '<div class="field full"><label>正文 HTML</label><textarea class="tl-body"></textarea></div>' +
    '<div class="field full"><label>移动端短文</label><textarea class="tl-mobile"></textarea></div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';

  var CRED_ITEM_BLANK =
    '<div class="form-grid">' +
    '<div class="field full image-field"><label>图片</label><div class="image-field-row">' +
    '<input class="ci-image" type="text"><button type="button" class="btn btn-ghost btn-sm" data-pick-inline>从媒体库选图</button></div></div>' +
    '<div class="field full"><label>说明 / Alt</label><input class="ci-alt" type="text"></div></div>' +
    '<button type="button" class="btn btn-ghost btn-sm rep-remove-item">删除图片</button>';

  function credGroupRowHtml(g) {
    g = g || { id: '', title: '', layout: 'grid', marqueeDuration: '', items: [] };
    var items = g.items && g.items.length ? g.items : [{ image: '', imageAlt: '' }];
    return '<div class="repeater-row cred-group"><div class="form-grid">' +
      '<div class="field"><label>分组 ID</label><input class="cg-id" type="text" value="' + escapeAttr(g.id || '') + '"></div>' +
      '<div class="field"><label>布局</label><select class="cg-layout">' +
      ['grid', 'marquee'].map(function (o) {
        return '<option value="' + o + '"' + ((g.layout || 'grid') === o ? ' selected' : '') + '>' + o + '</option>';
      }).join('') + '</select></div>' +
      '<div class="field full"><label>分组标题</label><input class="cg-title" type="text" value="' + escapeAttr(g.title || '') + '"></div>' +
      '<div class="field"><label>跑马灯时长</label><input class="cg-duration" type="text" value="' + escapeAttr(g.marqueeDuration || '') + '" placeholder="如 40s"></div>' +
      '</div><h4 class="sub-title">图片</h4><div class="repeater nested-rep">' +
      items.map(function (it) {
        return '<div class="repeater-row">' +
          '<div class="form-grid">' +
          '<div class="field full image-field"><label>图片</label><div class="image-field-row">' +
          '<input class="ci-image" type="text" value="' + escapeAttr(it.image || '') + '">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-pick-inline>从媒体库选图</button></div></div>' +
          '<div class="field full"><label>说明 / Alt</label><input class="ci-alt" type="text" value="' + escapeAttr(it.imageAlt || '') + '"></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove-item">删除图片</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-cred-item">＋ 添加图片</button></div>' +
      '<button type="button" class="btn btn-ghost btn-sm rep-remove">删除分组</button></div>';
  }

  function homeServiceStepsHtml(steps) {
    steps = steps && steps.length ? steps : [{ badge: '', badgeStyle: 'mid', title: '', items: [] }];
    return '<div class="repeater" id="rep-home-steps">' +
      steps.map(function (s) {
        return '<div class="repeater-row"><div class="form-grid">' +
          '<div class="field"><label>序号</label><input class="hs-badge" type="text" value="' + escapeAttr(s.badge || '') + '"></div>' +
          '<div class="field"><label>样式</label><select class="hs-style">' +
          ['start', 'mid', 'accent'].map(function (o) {
            return '<option value="' + o + '"' + ((s.badgeStyle || 'mid') === o ? ' selected' : '') + '>' + o + '</option>';
          }).join('') + '</select></div>' +
          '<div class="field full"><label>标题</label><input class="hs-title" type="text" value="' + escapeAttr(s.title || '') + '"></div>' +
          '<div class="field full"><label>要点（每行一条）</label><textarea class="hs-items">' + escapeHtml((s.items || []).join('\n')) + '</textarea></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-generic">＋ 添加步骤</button></div>';
  }

  function collectHomeServiceSteps() {
    var root = $('rep-home-steps');
    if (!root) return [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row) {
      return {
        badge: (row.querySelector('.hs-badge') || {}).value || '',
        badgeStyle: (row.querySelector('.hs-style') || {}).value || 'mid',
        title: (row.querySelector('.hs-title') || {}).value || '',
        items: ((row.querySelector('.hs-items') || {}).value || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean),
      };
    }).filter(function (x) { return x.title || x.badge; });
  }

  function channelRowsHtml(items) {
    items = items && items.length ? items : [{ type: 'phone', icon: '', href: '', target: '_self', eyebrow: '', title: '', value: '', hint: '', cta: '', colSpan: 1, hover: 'dark' }];
    return '<div class="repeater" id="rep-channels">' +
      items.map(function (c) {
        return '<div class="repeater-row"><div class="form-grid">' +
          '<div class="field"><label>类型</label><input class="ch-type" type="text" value="' + escapeAttr(c.type || '') + '"></div>' +
          '<div class="field"><label>图标</label><input class="ch-icon" type="text" value="' + escapeAttr(c.icon || '') + '"></div>' +
          '<div class="field"><label>标题</label><input class="ch-title" type="text" value="' + escapeAttr(c.title || '') + '"></div>' +
          '<div class="field"><label>显示值</label><input class="ch-value" type="text" value="' + escapeAttr(c.value || '') + '"></div>' +
          '<div class="field"><label>眉题</label><input class="ch-eyebrow" type="text" value="' + escapeAttr(c.eyebrow || '') + '"></div>' +
          '<div class="field"><label>提示</label><input class="ch-hint" type="text" value="' + escapeAttr(c.hint || '') + '"></div>' +
          '<div class="field full"><label>链接</label><input class="ch-href" type="text" value="' + escapeAttr(c.href || '') + '"></div>' +
          '<div class="field"><label>打开方式</label><select class="ch-target"><option value="_self"' + (c.target !== '_blank' ? ' selected' : '') + '>当前页</option><option value="_blank"' + (c.target === '_blank' ? ' selected' : '') + '>新窗口</option></select></div>' +
          '<div class="field"><label>占列</label><input class="ch-col" type="text" value="' + escapeAttr(c.colSpan != null ? c.colSpan : 1) + '"></div>' +
          '<div class="field"><label>悬停样式</label><input class="ch-hover" type="text" value="' + escapeAttr(c.hover || 'dark') + '"></div>' +
          '<div class="field full"><label>按钮文案（可选）</label><input class="ch-cta" type="text" value="' + escapeAttr(c.cta || '') + '"></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-generic">＋ 添加渠道</button></div>';
  }

  function collectChannels() {
    var root = $('rep-channels');
    if (!root) return [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row) {
      var ch = {
        type: (row.querySelector('.ch-type') || {}).value || '',
        icon: (row.querySelector('.ch-icon') || {}).value || '',
        href: (row.querySelector('.ch-href') || {}).value || '',
        target: (row.querySelector('.ch-target') || {}).value || '_self',
        eyebrow: (row.querySelector('.ch-eyebrow') || {}).value || '',
        title: (row.querySelector('.ch-title') || {}).value || '',
        value: (row.querySelector('.ch-value') || {}).value || '',
        hint: (row.querySelector('.ch-hint') || {}).value || '',
        colSpan: Number((row.querySelector('.ch-col') || {}).value) || 1,
        hover: (row.querySelector('.ch-hover') || {}).value || 'dark',
      };
      var cta = (row.querySelector('.ch-cta') || {}).value || '';
      if (cta) ch.cta = cta;
      return ch;
    }).filter(function (x) { return x.title || x.value || x.href; });
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
      items.map(function (p) {
        return '<div class="repeater-row"><div class="form-grid">' +
          '<div class="field full"><label>标题</label><input class="cp-title" type="text" value="' + escapeAttr(p.title || '') + '"></div>' +
          '<div class="field full"><label>正文 HTML</label><textarea class="cp-body">' + escapeHtml(p.bodyHtml || '') + '</textarea></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-generic">＋ 添加支柱</button></div>';
  }

  function collectCulturePillars() {
    var root = $('rep-culture-pillars');
    if (!root) return [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row) {
      return {
        title: (row.querySelector('.cp-title') || {}).value || '',
        bodyHtml: (row.querySelector('.cp-body') || {}).value || '',
      };
    }).filter(function (x) { return x.title || x.bodyHtml; });
  }

  function clientsItemsHtml(items) {
    items = items && items.length ? items : [{ image: '', imageAlt: '' }];
    return '<div class="repeater" id="rep-clients">' +
      items.map(function (it) {
        return '<div class="repeater-row"><div class="form-grid">' +
          '<div class="field full image-field"><label>Logo</label><div class="image-field-row">' +
          '<input class="cl-image" type="text" value="' + escapeAttr(it.image || '') + '">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-pick-inline>从媒体库选图</button></div></div>' +
          '<div class="field full"><label>说明 / Alt</label><input class="cl-alt" type="text" value="' + escapeAttr(it.imageAlt || '') + '"></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-generic">＋ 添加客户</button></div>';
  }

  function collectClientsItems() {
    var root = $('rep-clients');
    if (!root) return [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row) {
      return {
        image: (row.querySelector('.cl-image') || {}).value || '',
        imageAlt: (row.querySelector('.cl-alt') || {}).value || '',
      };
    }).filter(function (x) { return x.image || x.imageAlt; });
  }

  function carouselSlidesHtml(slides) {
    slides = slides && slides.length ? slides : [{ image: '', imageAlt: '', tag: '', title: '', desc: '', dotLabel: '', dotAria: '' }];
    return '<div class="repeater" id="rep-carousel">' +
      slides.map(function (s, i) {
        return '<div class="repeater-row"><div class="form-grid">' +
          '<div class="field full image-field"><label>图片</label><div class="image-field-row">' +
          '<input class="cs-image" type="text" value="' + escapeAttr(s.image || '') + '">' +
          '<button type="button" class="btn btn-ghost btn-sm" data-pick-inline>从媒体库选图</button></div></div>' +
          '<div class="field"><label>标题</label><input class="cs-title" type="text" value="' + escapeAttr(s.title || '') + '"></div>' +
          '<div class="field"><label>标签</label><input class="cs-tag" type="text" value="' + escapeAttr(s.tag || '') + '"></div>' +
          '<div class="field full"><label>描述</label><input class="cs-desc" type="text" value="' + escapeAttr(s.desc || '') + '"></div>' +
          '<div class="field full"><label>图片说明</label><input class="cs-alt" type="text" value="' + escapeAttr(s.imageAlt || '') + '"></div>' +
          '<div class="field"><label>圆点文案</label><input class="cs-dot" type="text" value="' + escapeAttr(s.dotLabel || '') + '"></div>' +
          '<div class="field"><label>圆点无障碍</label><input class="cs-dotAria" type="text" value="' + escapeAttr(s.dotAria || '') + '"></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-generic">＋ 添加幻灯片</button></div>';
  }

  function collectCarouselSlides(prevSlides) {
    var root = $('rep-carousel');
    if (!root) return [];
    prevSlides = prevSlides || [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row, i) {
      var slide = {
        image: (row.querySelector('.cs-image') || {}).value || '',
        imageAlt: (row.querySelector('.cs-alt') || {}).value || '',
        tag: (row.querySelector('.cs-tag') || {}).value || '',
        title: (row.querySelector('.cs-title') || {}).value || '',
        desc: (row.querySelector('.cs-desc') || {}).value || '',
        dotLabel: (row.querySelector('.cs-dot') || {}).value || '',
        dotAria: (row.querySelector('.cs-dotAria') || {}).value || '',
      };
      if (prevSlides[i] && prevSlides[i].fetchpriority) slide.fetchpriority = prevSlides[i].fetchpriority;
      return slide;
    }).filter(function (x) { return x.image || x.title; });
  }

  function timelineEventsHtml(events) {
    events = events && events.length ? events : [{ year: '', side: 'left', accent: false, bodyHtml: '', mobileBody: '' }];
    return '<div class="repeater" id="rep-timeline">' +
      events.map(function (ev) {
        return '<div class="repeater-row"><div class="form-grid">' +
          '<div class="field"><label>年份</label><input class="tl-year" type="text" value="' + escapeAttr(ev.year || '') + '"></div>' +
          '<div class="field"><label>侧边</label><select class="tl-side"><option value="left"' + (ev.side !== 'right' ? ' selected' : '') + '>左</option><option value="right"' + (ev.side === 'right' ? ' selected' : '') + '>右</option></select></div>' +
          '<div class="field"><label>强调</label><select class="tl-accent"><option value="false"' + (!ev.accent ? ' selected' : '') + '>否</option><option value="true"' + (ev.accent ? ' selected' : '') + '>是</option></select></div>' +
          '<div class="field"><label>年份强调</label><select class="tl-yearAccent"><option value="false"' + (!ev.yearAccent ? ' selected' : '') + '>否</option><option value="true"' + (ev.yearAccent ? ' selected' : '') + '>是</option></select></div>' +
          '<div class="field full"><label>导语 HTML（可选）</label><textarea class="tl-lead">' + escapeHtml(ev.leadHtml || '') + '</textarea></div>' +
          '<div class="field full"><label>正文 HTML</label><textarea class="tl-body">' + escapeHtml(ev.bodyHtml || '') + '</textarea></div>' +
          '<div class="field full"><label>移动端短文</label><textarea class="tl-mobile">' + escapeHtml(ev.mobileBody || '') + '</textarea></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button></div>';
      }).join('') +
      '<button type="button" class="btn btn-ghost btn-sm rep-add-generic">＋ 添加事件</button></div>';
  }

  function collectTimelineEvents() {
    var root = $('rep-timeline');
    if (!root) return [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row) {
      var ev = {
        year: (row.querySelector('.tl-year') || {}).value || '',
        side: (row.querySelector('.tl-side') || {}).value || 'left',
        accent: (row.querySelector('.tl-accent') || {}).value === 'true',
        bodyHtml: (row.querySelector('.tl-body') || {}).value || '',
        mobileBody: (row.querySelector('.tl-mobile') || {}).value || '',
      };
      if ((row.querySelector('.tl-yearAccent') || {}).value === 'true') ev.yearAccent = true;
      var lead = (row.querySelector('.tl-lead') || {}).value || '';
      if (lead) ev.leadHtml = lead;
      return ev;
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

  function collectCredentialsGroups() {
    var root = $('rep-cred-groups');
    if (!root) return [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .cred-group'), function (group) {
      var g = {
        id: (group.querySelector('.cg-id') || {}).value || '',
        title: (group.querySelector('.cg-title') || {}).value || '',
        layout: (group.querySelector('.cg-layout') || {}).value || 'grid',
        items: Array.prototype.map.call(group.querySelectorAll('.nested-rep > .repeater-row'), function (row) {
          return {
            image: (row.querySelector('.ci-image') || {}).value || '',
            imageAlt: (row.querySelector('.ci-alt') || {}).value || '',
          };
        }).filter(function (x) { return x.image || x.imageAlt; }),
      };
      var dur = (group.querySelector('.cg-duration') || {}).value || '';
      if (dur) g.marqueeDuration = dur;
      return g;
    }).filter(function (x) { return x.title || x.id || (x.items && x.items.length); });
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
    var slotsHtml = '<div class="card" id="home-slots-status"><h3 class="card-title">首页精选坑位</h3>' +
      '<p class="field-help">标杆 / 精选在「解决方案」「新闻中心」的条目详情里设置；下架占用项时须指定替代。</p>' +
      '<p class="help">加载中…</p></div>';
    var sections = [
      { key: 'seo', label: 'SEO', html: seoBlock(page) },
      {
        key: 'hero', label: 'Hero',
        html: cardBlock('Hero',
          field('hero-title', '主标题', hero.title) + field('hero-lead', '副文案', hero.lead, 'full', 'textarea') +
          field('hero-cta1-label', '主按钮文案', (hero.primaryCta || {}).label) + field('hero-cta1-href', '主按钮链接', (hero.primaryCta || {}).href) +
          field('hero-cta2-label', '次按钮文案', (hero.secondaryCta || {}).label) + field('hero-cta2-href', '次按钮链接', (hero.secondaryCta || {}).href)),
      },
      {
        key: 'featured', label: '标杆文案',
        html: cardBlock('标杆方案区文案',
          field('feat-eyebrow', '眉题', feat.eyebrow || '标杆方案') +
          field('feat-subtitle', '副标题覆盖（可选，空则用方案亮点）', feat.subtitle || '', 'full') +
          field('feat-cta', '按钮文案', feat.cta || '查看方案详情 →', 'full')),
      },
      { key: 'slots', label: '首页坑位', html: slotsHtml },
      {
        key: 'about', label: '关于区',
        html: '<div class="card"><h3 class="card-title">关于区块</h3><div class="form-grid">' +
          field('about-title', '标题', about.title, 'full') +
          richTextField('about-body', '正文', about.bodyHtml || '', '支持加粗、换行等基础排版') +
          '</div><h4 class="sub-title">统计数字</h4>' + statsRowsHtml(about.stats || []) + '</div>',
      },
      {
        key: 'products', label: '三大类目',
        html: '<div class="card"><h3 class="card-title">产品类目区块</h3><div class="form-grid">' +
          field('prod-sec-title', '标题', products.title, 'full') +
          field('prod-sec-subtitle', '副标题', products.subtitle, 'full', 'textarea') +
          '<p class="form-section-title">固定卡片 · 单元设备</p>' +
          field('unit-eyebrow', '眉题', unit.eyebrow) +
          field('unit-href', '链接', unit.href || 'products.html') +
          field('unit-title', '标题', unit.title, 'full') +
          field('unit-summary', '简介', unit.summary, 'full', 'textarea') +
          field('unit-tags', '标签（每行一条）', (unit.tags || []).join('\n'), 'full', 'textarea') +
          imageField('unit-image', '图片', unit.image || '') +
          field('unit-alt', '图片说明', unit.imageAlt || '', 'full') +
          '</div></div>',
      },
      {
        key: 'service', label: '服务流程',
        html: '<div class="card"><h3 class="card-title">服务流程区块</h3><div class="form-grid">' +
          field('svc-sec-title', '标题', service.title, 'full') +
          field('svc-sec-subtitle', '副标题', service.subtitle, 'full', 'textarea') +
          '</div><h4 class="sub-title">步骤</h4>' + homeServiceStepsHtml(service.steps || []) + '</div>',
      },
      {
        key: 'news', label: '新闻区',
        html: '<div class="card"><h3 class="card-title">新闻区块文案</h3><div class="form-grid">' +
          field('news-sec-title', '标题', news.title, 'full') +
          field('news-sec-mission-title', '初心标题', news.missionTitle) +
          field('news-sec-mission-body', '初心正文', news.missionBody, 'full', 'textarea') +
          field('news-sec-cta-label', 'CTA 文案', (news.cta || {}).label) +
          field('news-sec-cta-href', 'CTA 链接', (news.cta || {}).href) +
          '<div class="field full"><p class="field-help">精选新闻条目请在「新闻中心 → 新闻条目」详情勾选首页精选（最多 2 条）。</p></div>' +
          '</div></div>',
      },
    ];
    $('page-home-form').innerHTML = buildSectionTabs('page-home-form', sections, 'hero');
    bindSectionTabs('page-home-form');
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
            return '<li>' + escapeHtml(it.name || it.title || it.id) +
              ' <span class="help">#' + escapeHtml(it.id) + '</span>' +
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
        '<h3 class="card-title">首页精选坑位</h3>' +
        '<p class="field-help">在「解决方案 / 新闻中心」的条目详情里设置；仅已发布计入名额。</p>' +
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
      box.innerHTML = '<h3 class="card-title">首页精选坑位</h3><p class="help">' + escapeHtml(err.message) + '</p>';
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
          href: val('f-unit-href') || 'products.html',
          image: val('f-unit-image'),
          imageAlt: val('f-unit-alt'),
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
      { key: 'seo', label: 'SEO', html: seoBlock(page) },
      {
        key: 'hero', label: 'Hero',
        html: cardBlock('Hero',
          field('hero-title', '标题', hero.title, 'full') +
          richTextField('hero-lead', '导语', hero.leadHtml || '', '支持加粗等基础排版')),
      },
      {
        key: 'carousel', label: '工厂轮播',
        html: '<div class="card"><h3 class="card-title">工厂轮播</h3><div class="form-grid">' +
          field('carousel-aria', '区块无障碍标签', carousel.sectionAriaLabel || '', 'full') +
          field('carousel-prev', '上一张文案', carousel.prevLabel || '') +
          field('carousel-next', '下一张文案', carousel.nextLabel || '') +
          '</div><h4 class="sub-title">幻灯片</h4>' + carouselSlidesHtml(carousel.slides || []) + '</div>',
      },
      {
        key: 'stats', label: '统计数字',
        html: '<div class="card"><h3 class="card-title">统计数字</h3><div class="form-grid">' +
          field('stats-columns', '列数', stats.columns != null ? stats.columns : 5) +
          '</div><h4 class="sub-title">条目</h4>' + statsRowsHtml(stats.items || []) + '</div>',
      },
      {
        key: 'culture', label: '企业文化',
        html: '<div class="card"><h3 class="card-title">企业文化</h3><div class="form-grid">' +
          richTextField('culture-headline', '标语', culture.headlineHtml || '') +
          '</div><h4 class="sub-title">支柱</h4>' + culturePillarsHtml(culture.pillars || []) + '</div>',
      },
      {
        key: 'timeline', label: '发展历程',
        html: '<div class="card"><h3 class="card-title">发展历程</h3><div class="form-grid">' +
          field('timeline-title', '标题', timeline.title || '', 'full') +
          field('timeline-subtitle', '副标题', timeline.subtitle || '', 'full', 'textarea') +
          '</div><h4 class="sub-title">事件</h4>' + timelineEventsHtml(timeline.events || []) + '</div>',
      },
      {
        key: 'credentials', label: '资质画廊',
        html: '<div class="card"><h3 class="card-title">资质画廊</h3><div class="form-grid">' +
          field('cred-title', '标题', credentials.title || '', 'full') +
          field('cred-subtitle', '副标题', credentials.subtitle || '', 'full', 'textarea') +
          '</div><h4 class="sub-title">分组</h4>' + credentialsGroupsHtml(credentials.groups || []) + '</div>',
      },
      {
        key: 'clients', label: '合作客户',
        html: '<div class="card"><h3 class="card-title">合作客户</h3><div class="form-grid">' +
          field('clients-title', '标题', clients.title || '', 'full') +
          field('clients-subtitle', '副标题', clients.subtitle || '', 'full', 'textarea') +
          '</div><h4 class="sub-title">Logo 列表</h4>' + clientsItemsHtml(clients.items || []) + '</div>',
      },
    ];
    $('page-about-form').innerHTML = buildSectionTabs('page-about-form', sections, 'hero');
    bindSectionTabs('page-about-form');
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
        pillars: collectCulturePillars(),
      },
      carousel: {
        sectionAriaLabel: val('f-carousel-aria'),
        prevLabel: val('f-carousel-prev'),
        nextLabel: val('f-carousel-next'),
        slides: collectCarouselSlides(prevSlides),
      },
      stats: {
        columns: Number(val('f-stats-columns')) || 5,
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
        groups: collectCredentialsGroups(),
      },
      clients: {
        title: val('f-clients-title'),
        subtitle: val('f-clients-subtitle'),
        items: collectClientsItems(),
      },
    };
  }

  function locationRowsHtml(items) {
    items = items && items.length ? items : [{ name: '', address: '', navLabel: '', navUrl: '', badge: '' }];
    return '<div class="repeater" id="rep-locations">' +
      items.map(function (loc) {
        return '<div class="repeater-row"><div class="form-grid">' +
          '<div class="field"><label>名称</label><input class="loc-name" type="text" value="' + escapeAttr(loc.name || '') + '"></div>' +
          '<div class="field"><label>徽章</label><input class="loc-badge" type="text" value="' + escapeAttr(loc.badge || '') + '"></div>' +
          '<div class="field full"><label>地址</label><input class="loc-address" type="text" value="' + escapeAttr(loc.address || '') + '"></div>' +
          '<div class="field"><label>导航文案</label><input class="loc-navLabel" type="text" value="' + escapeAttr(loc.navLabel || '') + '"></div>' +
          '<div class="field"><label>导航链接</label><input class="loc-navUrl" type="text" value="' + escapeAttr(loc.navUrl || '') + '"></div>' +
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
        row.innerHTML = '<div class="form-grid">' +
          '<div class="field"><label>名称</label><input class="loc-name" type="text"></div>' +
          '<div class="field"><label>徽章</label><input class="loc-badge" type="text"></div>' +
          '<div class="field full"><label>地址</label><input class="loc-address" type="text"></div>' +
          '<div class="field"><label>导航文案</label><input class="loc-navLabel" type="text"></div>' +
          '<div class="field"><label>导航链接</label><input class="loc-navUrl" type="text"></div>' +
          '</div><button type="button" class="btn btn-ghost btn-sm rep-remove">删除</button>';
        root.insertBefore(row, t);
      }
      if (t.classList.contains('rep-remove')) {
        var r = t.closest('.repeater-row');
        if (r && root.querySelectorAll(':scope > .repeater-row').length > 1) r.remove();
      }
    });
  }

  function collectLocations() {
    var root = $('rep-locations');
    if (!root) return [];
    return Array.prototype.map.call(root.querySelectorAll(':scope > .repeater-row'), function (row) {
      var loc = {
        name: (row.querySelector('.loc-name') || {}).value || '',
        address: (row.querySelector('.loc-address') || {}).value || '',
        navLabel: (row.querySelector('.loc-navLabel') || {}).value || '',
        navUrl: (row.querySelector('.loc-navUrl') || {}).value || '',
        badge: (row.querySelector('.loc-badge') || {}).value || '',
      };
      if (!loc.badge) delete loc.badge;
      return loc;
    }).filter(function (x) { return x.name || x.address; });
  }

  function renderContactForm(page) {
    var hero = page.hero || {};
    var map = page.map || {};
    var center = (map.center || []).join(', ');
    var sections = [
      { key: 'seo', label: 'SEO', html: seoBlock(page) },
      {
        key: 'hero', label: 'Hero',
        html: cardBlock('Hero', field('hero-title', '标题', hero.title, 'full') + field('hero-lead', '导语', hero.lead, 'full', 'textarea')),
      },
      {
        key: 'channels', label: '联系渠道',
        html: '<div class="card"><h3 class="card-title">联系渠道</h3>' + channelRowsHtml(page.channels || []) + '</div>',
      },
      {
        key: 'map', label: '地图',
        html: cardBlock('地图',
          field('map-title', '标题', map.title || '', 'full') +
          field('map-center', '中心坐标 lng,lat', center, 'full') +
          field('map-zoom', '缩放级别', map.zoom != null ? map.zoom : 14)),
      },
      {
        key: 'locations', label: '工厂地址',
        html: '<div class="card"><h3 class="card-title">工厂地址</h3>' + locationRowsHtml(page.locations || []) + '</div>',
      },
    ];
    $('page-contact-form').innerHTML = buildSectionTabs('page-contact-form', sections, 'hero');
    bindSectionTabs('page-contact-form');
    bindLocationRepeater();
    bindGenericRepeater('rep-channels', CHANNEL_BLANK);
    bindLeafRepeaterRemove('rep-channels');
    bindImageFields($('page-contact-form'));
  }

  function collectContactForm() {
    var centerRaw = val('f-map-center').split(/[,，\s]+/).map(Number).filter(function (n) { return !isNaN(n); });
    return {
      pageKey: 'contact', lang: 'zh',
      seo: collectSeo(),
      hero: { title: val('f-hero-title'), lead: val('f-hero-lead') },
      channels: collectChannels(),
      map: {
        title: val('f-map-title'),
        center: centerRaw.length >= 2 ? [centerRaw[0], centerRaw[1]] : [114.316297, 22.726056],
        zoom: Number(val('f-map-zoom')) || 14,
      },
      locations: collectLocations().map(function (loc, i) {
        var prev = ((state.pageCache.contact || {}).locations || [])[i];
        if (prev && prev.dotColor) loc.dotColor = prev.dotColor;
        return loc;
      }),
    };
  }

  function renderListPageForm(key, page) {
    var formId = 'page-' + key + '-form';
    var filters = page.filters || {};
    var extraSection;
    if (key === 'solutions') {
      extraSection = {
        key: 'pillars',
        label: '价值支柱',
        html: '<div class="card"><h3 class="card-title">价值支柱</h3>' + pillarsRowsHtml(page.pillars || []) + '</div>',
      };
    } else {
      extraSection = {
        key: 'filters',
        label: '筛选文案',
        html: cardBlock('筛选文案',
          field('filters-all', '「全部」按钮文案', filters.all || (key === 'news' ? '全部资讯' : '全部产品'), 'full') +
          '<div class="field full"><p class="field-help">分类按钮文案由「全站 → 分类」维护，保存分类后会自动同步到本页 filters。</p></div>'),
      };
    }
    var sections = [
      { key: 'seo', label: 'SEO', html: seoBlock(page) },
      {
        key: 'hero', label: 'Hero',
        html: cardBlock('Hero',
          field('hero-title', '标题', (page.hero || {}).title, 'full') +
          field('hero-lead', '导语', (page.hero || {}).lead || '', 'full', 'textarea')),
      },
      extraSection,
    ];
    $(formId).innerHTML = buildSectionTabs(formId, sections, 'hero');
    bindSectionTabs(formId);
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
    } else {
      var prev = ((state.pageCache[key] || {}).filters) || {};
      body.filters = Object.assign({}, prev, { all: val('f-filters-all') || prev.all || '' });
    }
    return body;
  }

  async function savePage(key) {
    try {
      var body;
      if (key === 'home') body = collectHomeForm();
      else if (key === 'about') body = collectAboutForm();
      else if (key === 'contact') body = collectContactForm();
      else body = collectListPageForm(key);
      await api('/admin/pages/' + key, { method: 'PUT', body: JSON.stringify(body) });
      state.pageCache[key] = body;
      toast('页面已保存');
    } catch (err) {
      toast(err.message || '保存失败', true);
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
    tagline: '标语', wechatAlt: '微信图 Alt', copyright: '版权文案', icp: '备案号', icpUrl: '备案链接',
  };

  async function loadSiteForm() {
    var site = await api('/admin/site');
    state.siteCache = site;
    var sections = [
      { key: 'nav', label: '导航', html: cardBlock('导航文案', siteKvFields('nav', site.nav, SITE_NAV_LABELS)) },
      { key: 'lang', label: '语言切换', html: cardBlock('语言切换标签', siteKvFields('lang', site.lang, SITE_LANG_LABELS)) },
      { key: 'common', label: '通用文案', html: cardBlock('通用文案', siteKvFields('common', site.common, SITE_COMMON_LABELS)) },
      { key: 'footer', label: '页脚', html: cardBlock('页脚', siteKvFields('footer', site.footer, SITE_FOOTER_LABELS)) },
      {
        key: 'advanced', label: '高级 JSON',
        html: advancedBlock(
          field('nav-json', 'nav JSON', JSON.stringify(site.nav || {}, null, 2), 'full', 'textarea-code') +
          field('lang-json', 'lang JSON', JSON.stringify(site.lang || {}, null, 2), 'full', 'textarea-code') +
          field('common-json', 'common JSON', JSON.stringify(site.common || {}, null, 2), 'full', 'textarea-code') +
          field('footer-json', 'footer JSON', JSON.stringify(site.footer || {}, null, 2), 'full', 'textarea-code') +
          '<div class="field full"><p class="field-help">若修改了上方表单，请直接点保存；高级 JSON 仅在需要增减字段时使用（保存时以表单为准，除非勾选下方覆盖）。</p>' +
          '<label class="check-row" style="text-transform:none"><input type="checkbox" id="site-use-json"> 保存时使用高级 JSON 覆盖表单</label></div>'),
      },
    ];
    $('site-form').innerHTML = buildSectionTabs('site-form', sections, 'nav');
    bindSectionTabs('site-form');
  }

  async function saveSite() {
    try {
      var body;
      if ($('site-use-json') && $('site-use-json').checked) {
        body = {
          nav: JSON.parse(val('f-nav-json') || '{}'),
          lang: JSON.parse(val('f-lang-json') || '{}'),
          common: JSON.parse(val('f-common-json') || '{}'),
          footer: JSON.parse(val('f-footer-json') || '{}'),
        };
      } else {
        body = {
          nav: collectSiteKv('nav', SITE_NAV_LABELS),
          lang: collectSiteKv('lang', SITE_LANG_LABELS),
          common: collectSiteKv('common', SITE_COMMON_LABELS),
          footer: collectSiteKv('footer', SITE_FOOTER_LABELS),
        };
        /* preserve any extra keys not in the form */
        var prev = state.siteCache || {};
        ['nav', 'lang', 'common', 'footer'].forEach(function (section) {
          body[section] = Object.assign({}, prev[section] || {}, body[section]);
        });
      }
      await api('/admin/site', { method: 'PUT', body: JSON.stringify(body) });
      state.siteCache = body;
      toast('站点文案已保存');
    } catch (err) {
      toast(err.message || '保存失败', true);
    }
  }

  /* Media */
  async function loadMedia() {
    var data = await api('/admin/media');
    var items = data.items || [];
    if (!items.length) {
      $('media-grid').innerHTML = '<p class="empty">暂无上传图片。点击右上角选择文件上传。</p>';
      return;
    }
    $('media-grid').innerHTML = items.map(function (m) {
      return '<div class="media-item"><img src="' + escapeHtml(assetUrl(m.path)) + '" alt="' + escapeAttr(m.alt || '') + '">' +
        '<div class="meta"><code>' + escapeHtml(m.path) + '</code>' +
        '<input class="media-alt" data-id="' + escapeAttr(m.filename) + '" type="text" placeholder="Alt 文案" value="' + escapeAttr(m.alt || '') + '" style="width:100%;margin-top:6px">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-copy="' + escapeAttr(m.path) + '">复制路径</button> ' +
        '<button type="button" class="btn btn-ghost btn-sm btn-danger-text" data-del="' + escapeAttr(m.filename) + '">删除</button></div></div>';
    }).join('');
    $('media-grid').querySelectorAll('[data-copy]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var path = btn.getAttribute('data-copy');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(path).then(function () { toast('已复制'); });
        } else {
          toast(path);
        }
      });
    });
    $('media-grid').querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('确认删除该图片？')) return;
        try {
          await api('/admin/media/' + encodeURIComponent(btn.getAttribute('data-del')), { method: 'DELETE' });
          toast('已删除');
          loadMedia();
        } catch (err) { toast(err.message, true); }
      });
    });
    $('media-grid').querySelectorAll('.media-alt').forEach(function (input) {
      input.addEventListener('change', async function () {
        try {
          await api('/admin/media/' + encodeURIComponent(input.getAttribute('data-id')), {
            method: 'PUT',
            body: JSON.stringify({ alt: input.value }),
          });
          toast('Alt 已保存');
        } catch (err) { toast(err.message, true); }
      });
    });
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

  async function loadTranslation() {
    var status = await api('/admin/translation-status');
    var cfg = await api('/admin/translation-config').catch(function () { return null; });
    if (cfg && $('translation-config')) {
      $('translation-config').innerHTML =
        '<strong>翻译引擎：</strong>' + escapeHtml(cfg.provider) +
        (cfg.model ? ' · ' + escapeHtml(cfg.model) : '') +
        (cfg.hasApiKey ? ' · API Key 已配置' : ' · 未配置 API Key（echo 联调）') +
        '<br><span style="opacity:.85">环境变量：TRANSLATION_PROVIDER=deepseek · TRANSLATION_API_KEY（或 DEEPSEEK_API_KEY）· TRANSLATION_MODEL</span>';
    }
    var rows = Object.keys(status.resources || {}).sort().map(function (resource) {
      var langs = status.resources[resource];
      return '<tr><td><strong>' + escapeHtml(resource) + '</strong></td>' +
        '<td><span class="badge badge-' + escapeHtml(langs.en) + '">' + escapeHtml(langs.en) + '</span></td>' +
        '<td><span class="badge badge-' + escapeHtml(langs.ru) + '">' + escapeHtml(langs.ru) + '</span></td>' +
        '<td class="toolbar">' +
        '<button type="button" class="btn btn-ghost btn-sm" data-res="' + escapeHtml(resource) + '" data-lang="en">en → current</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-res="' + escapeHtml(resource) + '" data-lang="ru">ru → current</button>' +
        '<button type="button" class="btn btn-ghost btn-sm" data-job-res="' + escapeHtml(resource) + '">建任务</button></td></tr>';
    }).join('');
    $('translation-table').innerHTML =
      '<table class="data"><thead><tr><th>资源</th><th>EN</th><th>RU</th><th>操作</th></tr></thead><tbody>' + rows +
      '</tbody></table><p style="margin-top:12px;color:var(--muted);font-size:13px">更新于 ' +
      escapeHtml(status.updatedAt || '—') + '</p>';
    $('translation-table').querySelectorAll('button[data-res]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          await api('/admin/translation-status/mark-current', {
            method: 'POST',
            body: JSON.stringify({ resource: btn.getAttribute('data-res'), lang: btn.getAttribute('data-lang') }),
          });
          toast('已标记 current');
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
          toast('任务已创建');
          loadTranslationJobs();
        } catch (err) { toast(err.message, true); }
      });
    });
    await loadTranslationJobs();
  }

  async function loadTranslationJobs() {
    var data = await api('/admin/translation-jobs');
    var jobs = data.jobs || [];
    if (!jobs.length) {
      $('translation-jobs-table').innerHTML = '<p style="color:var(--muted);font-size:14px;padding:8px">暂无任务</p>';
      return;
    }
    var rows = jobs.map(function (job) {
      var langs = (job.targetLangs || []).join(', ');
      var actions = '';
      if (job.status === 'pending' || job.status === 'failed' || job.status === 'applied' || job.status === 'done') {
        actions += '<button type="button" class="btn btn-accent btn-sm" data-run="' + job.id + '">运行</button>';
      }
      if (job.status === 'done') {
        actions += '<button type="button" class="btn btn-ghost btn-sm" data-apply="' + job.id + '">应用</button>';
      }
      var msg = job.result && job.result.message ? job.result.message : (job.error || '—');
      return '<tr><td>#' + job.id + '</td><td><strong>' + escapeHtml(job.resource) + '</strong></td>' +
        '<td>' + escapeHtml(langs) + '</td>' +
        '<td><span class="badge badge-' + escapeHtml(job.status) + '">' + escapeHtml(job.status) + '</span></td>' +
        '<td style="max-width:280px;font-size:12px;color:var(--muted)">' + escapeHtml(msg) + '</td>' +
        '<td class="toolbar">' + actions + '</td></tr>';
    }).join('');
    $('translation-jobs-table').innerHTML =
      '<table class="data"><thead><tr><th>ID</th><th>资源</th><th>目标</th><th>状态</th><th>说明</th><th>操作</th></tr></thead><tbody>' +
      rows + '</tbody></table>';
    $('translation-jobs-table').querySelectorAll('[data-run]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        btn.disabled = true;
        toast('翻译运行中…');
        try {
          await api('/admin/translation-jobs/' + btn.getAttribute('data-run') + '/run', { method: 'POST', body: '{}' });
          toast('翻译完成');
          loadTranslation();
        } catch (err) { toast(err.message, true); loadTranslationJobs(); }
      });
    });
    $('translation-jobs-table').querySelectorAll('[data-apply]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        try {
          await api('/admin/translation-jobs/' + btn.getAttribute('data-apply') + '/apply', { method: 'POST', body: '{}' });
          toast('已应用并标记 current');
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
  $('logout-btn').addEventListener('click', function () {
    token = '';
    sessionStorage.removeItem('txam_admin_token');
    sessionStorage.removeItem('txam_admin_actor');
    actorName = '';
    updateUserChip();
    showLogin(true);
  });

  document.querySelectorAll('.nav-item').forEach(function (btn) {
    btn.addEventListener('click', function () { setView(btn.getAttribute('data-view')); });
  });
  document.querySelectorAll('.nav-group-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.closest('.nav-group');
      if (!group) return;
      var open = group.classList.toggle('is-collapsed');
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
    });
  });
  document.querySelectorAll('.hub-tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var hub = btn.closest('.hub-tabs');
      if (!hub) return;
      var key = hub.getAttribute('data-hub');
      var tab = btn.getAttribute('data-hub-tab');
      applyHubTab(key, tab);
      if (tab === 'items') {
        if (key === 'products') loadProducts().catch(function (e) { toast(e.message, true); });
        if (key === 'news') loadNews().catch(function (e) { toast(e.message, true); });
        if (key === 'solutions') loadSolutions().catch(function (e) { toast(e.message, true); });
      } else if (tab === 'page') {
        loadPageForm(key).catch(function (e) { toast(e.message, true); });
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

  $('refresh-dash').addEventListener('click', function () { loadDashboard().catch(function (e) { toast(e.message, true); }); });
  $('refresh-translation').addEventListener('click', function () { loadTranslation().catch(function (e) { toast(e.message, true); }); });
  $('refresh-jobs').addEventListener('click', function () { loadTranslationJobs().catch(function (e) { toast(e.message, true); }); });
  $('enqueue-stale-jobs').addEventListener('click', async function () {
    try {
      var result = await api('/admin/translation-jobs', {
        method: 'POST',
        body: JSON.stringify({ enqueueStale: true }),
      });
      toast('已创建 ' + (result.created || 0) + ' 个任务');
      loadTranslation();
    } catch (err) { toast(err.message, true); }
  });
  if ($('sync-all-stale')) {
    $('sync-all-stale').addEventListener('click', async function () {
      var btn = $('sync-all-stale');
      btn.disabled = true;
      try {
        toast('正在准备翻译任务…');
        await api('/admin/translation-jobs', {
          method: 'POST',
          body: JSON.stringify({ enqueueStale: true }),
        });
        var data = await api('/admin/translation-jobs');
        var jobs = (data.jobs || []).filter(function (j) {
          return j.status === 'pending' || j.status === 'failed';
        });
        if (!jobs.length) {
          toast('没有需要同步的内容');
          loadTranslation();
          return;
        }
        for (var i = 0; i < jobs.length; i++) {
          toast('正在翻译（' + (i + 1) + '/' + jobs.length + '）：' + jobs[i].resource);
          await api('/admin/translation-jobs/' + jobs[i].id + '/run', { method: 'POST', body: '{}' });
        }
        toast('已完成 ' + jobs.length + ' 项翻译同步');
        loadTranslation();
      } catch (err) {
        toast(err.message || '同步失败', true);
        loadTranslation().catch(function () {});
      } finally {
        btn.disabled = false;
      }
    });
  }
  $('refresh-media').addEventListener('click', function () { loadMedia().catch(function (e) { toast(e.message, true); }); });
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
  $('product-search').addEventListener('input', renderProductTable);
  $('news-search').addEventListener('input', renderNewsTable);
  $('solution-search').addEventListener('input', renderSolutionTable);
  if ($('product-search-btn')) $('product-search-btn').addEventListener('click', renderProductTable);
  if ($('news-search-btn')) $('news-search-btn').addEventListener('click', renderNewsTable);
  if ($('solution-search-btn')) $('solution-search-btn').addEventListener('click', renderSolutionTable);
  if ($('product-filter-status')) {
    $('product-filter-status').addEventListener('change', renderProductTable);
  }
  if ($('sidebar-toggle')) {
    $('sidebar-toggle').addEventListener('click', function () {
      var shell = $('app-view');
      if (!shell) return;
      shell.classList.toggle('is-collapsed');
      var collapsed = shell.classList.contains('is-collapsed');
      $('sidebar-toggle').title = collapsed ? '展开菜单' : '折叠菜单';
      $('sidebar-toggle').setAttribute('aria-label', collapsed ? '展开菜单' : '折叠菜单');
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
  if ($('refresh-categories')) {
    $('refresh-categories').addEventListener('click', function () {
      loadCategories().catch(function (e) { toast(e.message, true); });
    });
  }
  if ($('add-product-cat')) {
    $('add-product-cat').addEventListener('click', function () { editProductCategory(null); });
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

  if (token) {
    updateUserChip();
    showLogin(false);
    setView('dashboard');
  } else {
    showLogin(true);
  }
})();
