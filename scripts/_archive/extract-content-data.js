/**
 * Extract product/solution/news data from HTML into data/*.json
 * and generate i18n UI strings + product schema.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function extractObjectLiteral(html, varName) {
  const marker = `const ${varName} = `;
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`Cannot find ${varName}`);
  let i = start + marker.length;
  while (i < html.length && /\s/.test(html[i])) i++;
  if (html[i] !== '{') throw new Error(`${varName} does not start with {`);

  let depth = 0;
  let inStr = false;
  let strQuote = '';
  let escaped = false;
  let inTemplate = false;
  let templateDepth = 0;
  const begin = i;

  for (; i < html.length; i++) {
    const ch = html[i];
    const next = html[i + 1];

    if (inStr) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === strQuote) inStr = false;
      continue;
    }

    if (inTemplate) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '`' && templateDepth === 0) {
        inTemplate = false;
        continue;
      }
      if (ch === '$' && next === '{') {
        templateDepth++;
        i++;
        depth++;
        continue;
      }
      if (ch === '{' && templateDepth > 0) {
        depth++;
        continue;
      }
      if (ch === '}') {
        depth--;
        if (templateDepth > 0 && depth === templateDepth - 1 + depth) {
          // handled below via depth tracking relative to outer
        }
        // When closing a ${} expression inside template
        if (templateDepth > 0) {
          // depth was increased for both outer object and ${}
          // simpler approach: track separately
        }
        continue;
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inStr = true;
      strQuote = ch;
      continue;
    }
    if (ch === '`') {
      inTemplate = true;
      templateDepth = 0;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const literal = html.slice(begin, i + 1);
        return literal;
      }
    }
  }
  throw new Error(`Unclosed object for ${varName}`);
}

/** More reliable brace matcher that handles strings and templates */
function extractObjectLiteralV2(html, varName) {
  const marker = `const ${varName} = `;
  const start = html.indexOf(marker);
  if (start < 0) throw new Error(`Cannot find ${varName}`);
  let i = start + marker.length;
  while (i < html.length && /\s/.test(html[i])) i++;
  if (html[i] !== '{') throw new Error(`${varName} does not start with {`);

  const begin = i;
  let depth = 0;
  let mode = 'code'; // code | squote | dquote | template
  let escaped = false;
  // template expression stack: when inside `, ${ pushes 'code' onto stack
  const stack = ['code'];

  for (; i < html.length; i++) {
    const ch = html[i];
    const next = html[i + 1];
    mode = stack[stack.length - 1];

    if (mode === 'squote' || mode === 'dquote') {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if ((mode === 'squote' && ch === "'") || (mode === 'dquote' && ch === '"')) {
        stack.pop();
      }
      continue;
    }

    if (mode === 'template') {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === '`') {
        stack.pop();
        continue;
      }
      if (ch === '$' && next === '{') {
        stack.push('texpr');
        i++;
        continue;
      }
      continue;
    }

    if (mode === 'texpr') {
      // Inside ${...} of a template literal
      if (ch === '"' ) {
        stack.push('dquote');
        continue;
      }
      if (ch === "'") {
        stack.push('squote');
        continue;
      }
      if (ch === '`') {
        stack.push('template');
        continue;
      }
      if (ch === '{') {
        stack.push('texpr');
        continue;
      }
      if (ch === '}') {
        stack.pop(); // close this texpr
        continue;
      }
      continue;
    }

    // mode === 'code'
    if (ch === "'") {
      stack.push('squote');
      continue;
    }
    if (ch === '"') {
      stack.push('dquote');
      continue;
    }
    if (ch === '`') {
      stack.push('template');
      continue;
    }
    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        return html.slice(begin, i + 1);
      }
      continue;
    }
  }
  throw new Error(`Unclosed object for ${varName}`);
}

function evalObjectLiteral(literal) {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`result = (${literal})`, sandbox, { timeout: 5000 });
  return sandbox.result;
}

function trimHtml(html) {
  if (html == null) return '';
  return String(html).replace(/^\s+|\s+$/g, '');
}

/**
 * Normalize image/cover paths to /assets/images/...
 */
function normalizeImage(raw, kind) {
  if (!raw) return '';
  let p = String(raw).trim().replace(/\\/g, '/');
  // strip leading ./ or /
  p = p.replace(/^\.\//, '').replace(/^\//, '');
  // already assets path
  if (p.startsWith('assets/images/')) return '/' + p;
  if (p.startsWith('/assets/images/')) return p;

  // products/...
  if (p.startsWith('products/')) return `/assets/images/${p}`;
  // solutions/...
  if (p.startsWith('solutions/')) return `/assets/images/${p}`;
  // news/...
  if (p.startsWith('news/')) return `/assets/images/${p}`;
  // hero/...
  if (p.startsWith('hero/')) return `/assets/images/${p}`;

  // Special / root-level assets → hero
  const heroRoots = new Set([
    'control-system.webp',
    'pkg-logistics-line.webp',
    'building-office.jpg',
    'news-tech.jpg',
    'factory-hero.webp',
    'shipping-container.jpg',
    'robot-arm.webp',
  ]);
  if (heroRoots.has(p) || !p.includes('/')) {
    return `/assets/images/hero/${p}`;
  }
  return `/assets/images/${p}`;
}

function mapProduct(id, item) {
  return {
    id: String(id),
    category: item.category || '',
    model: item.model || '',
    name: item.name || '',
    image: normalizeImage(item.image, 'product'),
    specs: Array.isArray(item.specs) ? item.specs : [],
    summary: item.desc || item.summary || '',
    contentHtml: trimHtml(item.detail || item.content || item.contentHtml || ''),
    published: item.published !== false,
  };
}

function mapSolution(id, item, lang) {
  const defaultCategory =
    lang === 'en' ? 'Solutions' : lang === 'ru' ? 'Решения' : '解决方案';
  const out = {
    id: String(id),
    category: item.category || defaultCategory,
    name: item.name || '',
    image: normalizeImage(item.image, 'solution'),
    specs: Array.isArray(item.specs) ? item.specs : [],
    summary: item.desc || item.summary || '',
    contentHtml: trimHtml(item.detail || item.content || item.contentHtml || ''),
    published: item.published !== false,
  };
  if (item.model) out.model = item.model;
  if (item.features != null) out.features = item.features;
  if (Array.isArray(item.painPoints)) out.painPoints = item.painPoints;
  if (Array.isArray(item.process)) out.process = item.process;
  return out;
}

function mapNews(id, item) {
  return {
    id: String(id),
    category: item.category || '',
    title: item.title || '',
    date: item.date || '',
    cover: normalizeImage(item.cover || item.image, 'news'),
    contentHtml: trimHtml(item.content || item.detail || item.contentHtml || ''),
    published: item.published !== false,
  };
}

function extractAndMap(htmlFile, varName, mapper, lang) {
  const html = read(htmlFile);
  const literal = extractObjectLiteralV2(html, varName);
  const data = evalObjectLiteral(literal);
  const out = {};
  for (const [id, item] of Object.entries(data)) {
    out[id] = mapper(id, item, lang);
  }
  return out;
}

function writeJson(relPath, data) {
  const full = path.join(ROOT, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, JSON.stringify(data, null, 2) + '\n', 'utf8');
  return Object.keys(data).length;
}

// --- Extract products ---
const productsZh = extractAndMap('product-detail.html', 'productData', mapProduct, 'zh');
const productsEn = extractAndMap('product-detail.html', 'productData', mapProduct, 'en');
const productsRu = extractAndMap('product-detail.html', 'productData', mapProduct, 'ru');

const cProdZh = writeJson('data/products/zh.json', productsZh);
const cProdEn = writeJson('data/products/en.json', productsEn);
const cProdRu = writeJson('data/products/ru.json', productsRu);

// --- Extract solutions ---
const solutionsZh = extractAndMap('solutions-detail.html', 'solutionData', mapSolution, 'zh');
const solutionsEn = extractAndMap('solutions-detail.html', 'solutionData', mapSolution, 'en');
const solutionsRu = extractAndMap('solutions-detail.html', 'solutionData', mapSolution, 'ru');

const cSolZh = writeJson('data/solutions/zh.json', solutionsZh);
const cSolEn = writeJson('data/solutions/en.json', solutionsEn);
const cSolRu = writeJson('data/solutions/ru.json', solutionsRu);

// --- Extract news ---
const newsZh = extractAndMap('news-detail.html', 'newsData', mapNews, 'zh');
const newsEn = extractAndMap('news-detail.html', 'newsData', mapNews, 'en');
const newsRu = extractAndMap('news-detail.html', 'newsData', mapNews, 'ru');

const cNewsZh = writeJson('data/news/zh.json', newsZh);
const cNewsEn = writeJson('data/news/en.json', newsEn);
const cNewsRu = writeJson('data/news/ru.json', newsRu);

// --- i18n ---
const i18nZh = {
  nav: {
    home: '首页',
    about: '关于我们',
    solutions: '解决方案',
    products: '产品中心',
    news: '新闻中心',
    contact: '联系我们',
  },
  lang: { zh: 'ZH', en: 'EN', ru: 'RU' },
  common: {
    relatedProducts: '相关产品',
    relatedSolutions: '相关解决方案',
    relatedArticles: '相关文章',
    coreParams: '核心参数',
    productFeatures: '产品特点',
    detailTitle: '详细说明',
    backToProducts: '返回产品中心',
    backToSolutions: '返回解决方案',
    breadcrumbHome: '首页',
    industryPainPoints: '行业痛点',
    coreProcess: '核心工艺流程',
  },
  footer: {
    tagline: '以卓越品质，不负每一份信任。',
    wechatAlt: '微信客服',
    copyright: '© 2007-2026 广东同兴高科智能装备有限公司.',
    icp: '粤ICP备16101583号-1',
    icpUrl: 'https://beian.miit.gov.cn/',
  },
};

const i18nEn = {
  nav: {
    home: 'Home',
    about: 'About Us',
    solutions: 'Solutions',
    products: 'Products',
    news: 'News',
    contact: 'Contact Us',
  },
  lang: { zh: 'ZH', en: 'EN', ru: 'RU' },
  common: {
    relatedProducts: 'Related Products',
    relatedSolutions: 'Related Solutions',
    relatedArticles: 'Related Articles',
    coreParams: 'Core Specifications',
    productFeatures: 'Product Features',
    detailTitle: 'Detailed Description',
    backToProducts: 'Back to Products',
    backToSolutions: 'Back to Solutions',
    breadcrumbHome: 'Home',
    industryPainPoints: 'Industry Pain Points',
    coreProcess: 'Core Process Flow',
  },
  footer: {
    tagline: 'Excellence in Quality, Trust in Every Delivery.',
    wechatAlt: 'WeChat',
    copyright: '© 2007-2026 Guangdong Tongxing High-Tech Intelligent Equipment Co., Ltd.',
    icp: '粤ICP备16101583号-1',
    icpUrl: 'https://beian.miit.gov.cn/',
  },
};

const i18nRu = {
  nav: {
    home: 'Главная',
    about: 'О нас',
    solutions: 'Решения',
    products: 'Продукция',
    news: 'Новости',
    contact: 'Контакты',
  },
  lang: { zh: 'ZH', en: 'EN', ru: 'RU' },
  common: {
    relatedProducts: 'Связанные продукты',
    relatedSolutions: 'Связанные решения',
    relatedArticles: 'Связанные статьи',
    coreParams: 'Основные характеристики',
    productFeatures: 'Особенности продукта',
    detailTitle: 'Подробное описание',
    backToProducts: 'Назад к продукции',
    backToSolutions: 'Назад к решениям',
    breadcrumbHome: 'Главная',
    industryPainPoints: 'Отраслевые проблемы',
    coreProcess: 'Основной технологический процесс',
  },
  footer: {
    tagline: 'Превосходное качество, доверие в каждой поставке.',
    wechatAlt: 'WeChat',
    copyright: '© 2007-2026 Guangdong Tongxing High-Tech Intelligent Equipment Co., Ltd.',
    icp: '粤ICP备16101583号-1',
    icpUrl: 'https://beian.miit.gov.cn/',
  },
};

writeJson('data/i18n/zh.json', i18nZh);
writeJson('data/i18n/en.json', i18nEn);
writeJson('data/i18n/ru.json', i18nRu);

// --- Product schema ---
const productSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  $id: 'https://tongxing.local/schemas/product.schema.json',
  title: 'ProductCatalog',
  description: 'Map of product id → product record',
  type: 'object',
  additionalProperties: {
    type: 'object',
    required: [
      'id',
      'category',
      'model',
      'name',
      'image',
      'specs',
      'summary',
      'contentHtml',
      'published',
    ],
    additionalProperties: false,
    properties: {
      id: {
        type: 'string',
        description: 'Product id (string, matching catalog key)',
      },
      category: { type: 'string' },
      model: { type: 'string' },
      name: { type: 'string' },
      image: {
        type: 'string',
        pattern: '^/assets/images/',
        description: 'Absolute site path under /assets/images/',
      },
      specs: {
        type: 'array',
        items: { type: 'string' },
      },
      summary: { type: 'string' },
      contentHtml: {
        type: 'string',
        description: 'HTML fragment for the detail body',
      },
      published: { type: 'boolean' },
    },
  },
};

writeJson('data/schema/product.schema.json', productSchema);

// Sample image paths check
const sampleImages = Object.values(productsZh)
  .slice(0, 5)
  .map((p) => p.image);
const specialImages = Object.values(productsZh)
  .filter((p) =>
    /control-system|pkg-logistics|commercial-display|solutions\//.test(p.image)
  )
  .map((p) => `${p.id}:${p.image}`);

console.log('=== Extraction complete ===');
console.log(`products zh/en/ru: ${cProdZh} / ${cProdEn} / ${cProdRu}`);
console.log(`solutions zh/en/ru: ${cSolZh} / ${cSolEn} / ${cSolRu}`);
console.log(`news zh/en/ru: ${cNewsZh} / ${cNewsEn} / ${cNewsRu}`);
console.log('i18n: zh, en, ru');
console.log('schema: data/schema/product.schema.json');
console.log('sample product images:', sampleImages);
console.log('special product images:', specialImages);
console.log(
  'news covers zh:',
  Object.values(newsZh).map((n) => n.cover)
);
