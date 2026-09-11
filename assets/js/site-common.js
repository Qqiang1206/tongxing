/**
 * Apply site.common labels to elements with data-i18n-common="key".
 * Also maps known hardcoded zh/en/ru titles when attributes are missing.
 */
(function (global) {
  // Chrome/Edge 126+ 跨文档 View Transitions（见 tx-view-transitions.css）在过渡被
  // 跳过/打断时，会抛出一个文档级、无调用方可 catch 的 AbortError unhandled
  // rejection——已知无害噪音。仅静默该类拒绝，其余照常上报。
  global.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    if (r && (r.name === 'AbortError' || /transition/i.test(String(r && r.message || '')))) {
      e.preventDefault();
    }
  });

  var FALLBACK_TEXT = {
    coreParams: ['核心参数', 'Core Specifications', 'Основные характеристики'],
    productFeatures: ['产品特点', 'Product Features', 'Особенности продукта'],
    detailTitle: ['详细说明', 'Detailed Description', 'Подробное описание'],
    relatedProducts: ['相关产品', 'Related Products', 'Связанные продукты'],
    relatedArticles: ['相关文章', 'Related Articles', 'Связанные статьи'],
    relatedSolutions: ['相关解决方案', 'Related Solutions', 'Связанные решения'],
    industryPainPoints: ['行业痛点', 'Industry Pain Points', 'Отраслевые проблемы'],
    coreProcess: ['核心工艺流程', 'Core Process Flow', 'Основной технологический процесс'],
    applicationAreas: ['应用领域', 'Application Areas', 'Области применения'],
    techAdvantages: ['技术优势', 'Technical Advantages', 'Технические преимущества'],
  };

  function applyCommon(common) {
    if (!common) return;
    document.querySelectorAll('[data-i18n-common]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-common');
      if (key && common[key]) el.textContent = common[key];
    });

    // Fallback: rewrite known static titles without attributes
    Object.keys(FALLBACK_TEXT).forEach(function (key) {
      if (!common[key]) return;
      var needles = FALLBACK_TEXT[key];
      document.querySelectorAll('h1,h2,h3,.detail-sidebar__label,.detail-section__title').forEach(function (el) {
        if (el.getAttribute('data-i18n-common')) return;
        var t = (el.textContent || '').trim();
        if (needles.indexOf(t) !== -1) {
          el.setAttribute('data-i18n-common', key);
          el.textContent = common[key];
        }
      });
    });
  }

  async function initSiteCommon(options) {
    options = options || {};
    var lang = options.lang || (global.TXAM && global.TXAM.detectLang()) || 'zh';
    if (!global.TXAM || !global.TXAM.loadSite) return;
    try {
      var site = await global.TXAM.loadSite(lang);
      applyCommon(site && site.common);
    } catch (err) {
      console.error(err);
    }
  }

  /** Escape HTML special chars to prevent XSS when inserting text into innerHTML. */
  function escapeHtml(str) {
    var s = String(str == null ? '' : str);
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  global.TXAM = global.TXAM || {};
  global.TXAM.initSiteCommon = initSiteCommon;
  global.TXAM.applyCommonLabels = applyCommon;
  global.TXAM.escapeHtml = escapeHtml;

  /**
   * 方案详情页路由 —— 全站唯一入口，禁止在页面脚本里各拼一份。
   *
   * 已生成静态落地页（-solution.html）的 slug 走静态页：有服务端渲染的正文，
   * 对搜索引擎友好，且是历史已收录的 URL。其余 slug 回落到统一模板
   * solutions-detail.html，避免后台新增方案后前台链接 404。
   *
   * 落地页清单由 scripts/generate-solution-landings.js 维护，
   * 用 `node scripts/generate-solution-landings.js --check` 校验与磁盘是否一致。
   */
  var SOLUTION_LANDING_SLUGS = [
    'tv-display',
    'refrigerator',
    'packaging',
    'washer',
    'capacitor',
    'ac',
    'microwave',
    'coffee',
    'tablet',
    'headlight',
  ];

  global.TXAM.solutionLandingSlugs = function () {
    return SOLUTION_LANDING_SLUGS.slice();
  };

  global.TXAM.hasSolutionLanding = function (slug) {
    return !!slug && SOLUTION_LANDING_SLUGS.indexOf(String(slug)) !== -1;
  };

  global.TXAM.solutionHref = function (item, pathPrefix) {
    var prefix = pathPrefix == null ? '' : pathPrefix;
    var slug = item && item.slug ? String(item.slug) : '';
    if (slug) {
      if (global.TXAM.hasSolutionLanding(slug)) return prefix + slug + '-solution.html';
      return prefix + 'solutions-detail.html?slug=' + encodeURIComponent(slug);
    }
    if (item && item.id != null) {
      return prefix + 'solutions-detail.html?id=' + encodeURIComponent(item.id);
    }
    return prefix + 'solutions.html';
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      var lang = (global.TXAM && global.TXAM.detectLang && global.TXAM.detectLang()) || 'zh';
      initSiteCommon({ lang: lang });
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
