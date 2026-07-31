/**
 * Apply site.common labels to elements with data-i18n-common="key".
 * Also maps known hardcoded zh/en/ru titles when attributes are missing.
 */
(function (global) {
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

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      var lang = (global.TXAM && global.TXAM.detectLang && global.TXAM.detectLang()) || 'zh';
      initSiteCommon({ lang: lang });
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
