/**
 * Product / solution / news category taxonomy (admin-managed).
 * Product & solution keys drive list-page filter buttons + item filterKey.
 */
import { getDb } from '../db.js';
import {
  readPageJson,
  writePageJsonAny,
  regeneratePageJs,
  regenerateCatalogJs,
} from './catalog.js';
import { markStale } from './translationStatus.js';

const PRODUCT_SEED = [
  { key: 'optical', name: '光学元件组装', nameEn: 'Optical Assembly', filterKeyEn: 'optical', sortOrder: 10 },
  { key: 'dispensing', name: '点胶装配', nameEn: 'Dispensing', filterKeyEn: 'dispensing', sortOrder: 20 },
  { key: 'flip', name: '翻转检测', nameEn: 'Flip Detection', filterKeyEn: 'flip', sortOrder: 30 },
  { key: 'screw', name: '锁付组装', nameEn: 'Screw Assembly', filterKeyEn: 'screw', sortOrder: 40 },
  { key: 'transfer', name: '搬运移载', nameEn: 'Transfer', filterKeyEn: 'transfer', sortOrder: 50 },
  { key: 'packaging', name: '后段包装', nameEn: 'Packaging', filterKeyEn: 'packaging', sortOrder: 60 },
  { key: 'robot', name: '机器人集成', nameEn: 'Robot Integration', filterKeyEn: 'robot', sortOrder: 70 },
  { key: 'line', name: '整线交付', nameEn: 'Production Lines', filterKeyEn: 'single', sortOrder: 80 },
  { key: 'software', name: '软件控制', nameEn: 'Software & Control', filterKeyEn: 'single', sortOrder: 90 },
];

const NEWS_SEED = [
  { key: 'company', name: '公司新闻', sortOrder: 10 },
  { key: 'project', name: '项目故事', sortOrder: 20 },
  { key: 'industry', name: '行业洞察', sortOrder: 30 },
];

const SOLUTION_SEED = [
  { key: 'tv-display', name: 'TV / 商显', nameEn: 'TV & Commercial Display', filterKeyEn: 'tv-display', sortOrder: 10 },
  { key: 'refrigerator', name: '冰箱', nameEn: 'Refrigerator', filterKeyEn: 'refrigerator', sortOrder: 20 },
  { key: 'packaging', name: '包装', nameEn: 'Packaging', filterKeyEn: 'packaging', sortOrder: 30 },
  { key: 'washer', name: '洗衣机', nameEn: 'Washer', filterKeyEn: 'washer', sortOrder: 40 },
  { key: 'capacitor', name: '电容', nameEn: 'Capacitor', filterKeyEn: 'capacitor', sortOrder: 50 },
  { key: 'ac', name: '空调', nameEn: 'Air Conditioning', filterKeyEn: 'ac', sortOrder: 60 },
  { key: 'microwave', name: '微波炉', nameEn: 'Microwave', filterKeyEn: 'microwave', sortOrder: 70 },
  { key: 'coffee', name: '咖啡机', nameEn: 'Coffee Machine', filterKeyEn: 'coffee', sortOrder: 80 },
  { key: 'tablet', name: '平板', nameEn: 'Tablet', filterKeyEn: 'tablet', sortOrder: 90 },
  { key: 'headlight', name: '车灯', nameEn: 'Headlight', filterKeyEn: 'headlight', sortOrder: 100 },
  { key: 'robot', name: '机器人', nameEn: 'Robot', filterKeyEn: 'robot', sortOrder: 110 },
];

let _pageFiltersSynced = false;
export function ensureCategoryTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_categories (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_en TEXT DEFAULT '',
      filter_key_en TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS news_categories (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS solution_categories (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_en TEXT DEFAULT '',
      filter_key_en TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  seedIfEmpty(db);
  if (!_pageFiltersSynced) {
    _pageFiltersSynced = true;
    try {
      syncProductPageFilters();
      syncNewsPageFilters();
    } catch (_) { /* page json may not exist yet */ }
  }
}

function seedIfEmpty(db) {
  const pc = db.prepare('SELECT COUNT(*) AS c FROM product_categories').get()?.c || 0;
  if (pc === 0) {
    const ins = db.prepare(
      `INSERT INTO product_categories (key, name, name_en, filter_key_en, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const row of PRODUCT_SEED) {
      ins.run(row.key, row.name, row.nameEn, row.filterKeyEn, row.sortOrder);
    }
  }
  const nc = db.prepare('SELECT COUNT(*) AS c FROM news_categories').get()?.c || 0;
  if (nc === 0) {
    const ins = db.prepare(
      `INSERT INTO news_categories (key, name, sort_order) VALUES (?, ?, ?)`
    );
    for (const row of NEWS_SEED) {
      ins.run(row.key, row.name, row.sortOrder);
    }
  }
  const sc = db.prepare('SELECT COUNT(*) AS c FROM solution_categories').get()?.c || 0;
  if (sc === 0) {
    const ins = db.prepare(
      `INSERT INTO solution_categories (key, name, name_en, filter_key_en, sort_order)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const row of SOLUTION_SEED) {
      ins.run(row.key, row.name, row.nameEn, row.filterKeyEn, row.sortOrder);
    }
    try {
      syncSolutionPageFilters();
    } catch (_) { /* page json may not exist yet */ }
  }
}

function rowProduct(r) {
  return {
    key: r.key,
    name: r.name,
    nameEn: r.name_en || '',
    filterKeyEn: r.filter_key_en || r.key,
    sortOrder: Number(r.sort_order) || 0,
  };
}

function rowSolution(r) {
  return {
    key: r.key,
    name: r.name,
    nameEn: r.name_en || '',
    filterKeyEn: r.filter_key_en || r.key,
    sortOrder: Number(r.sort_order) || 0,
  };
}

function rowNews(r) {
  return {
    key: r.key,
    name: r.name,
    sortOrder: Number(r.sort_order) || 0,
  };
}

export function listProductCategories() {
  const db = getDb();
  ensureCategoryTables(db);
  return db
    .prepare('SELECT * FROM product_categories ORDER BY sort_order, key')
    .all()
    .map(rowProduct);
}

export function listNewsCategories() {
  const db = getDb();
  ensureCategoryTables(db);
  return db
    .prepare('SELECT * FROM news_categories ORDER BY sort_order, key')
    .all()
    .map(rowNews);
}

export function listSolutionCategories() {
  const db = getDb();
  ensureCategoryTables(db);
  return db
    .prepare('SELECT * FROM solution_categories ORDER BY sort_order, key')
    .all()
    .map(rowSolution);
}

export function getCategoriesBundle() {
  return {
    products: listProductCategories(),
    news: listNewsCategories(),
    solutions: listSolutionCategories(),
  };
}

function assertKey(key) {
  const k = String(key || '').trim().toLowerCase();
  if (!/^[a-z][a-z0-9_-]{0,31}$/.test(k)) {
    throw new Error('invalid_category_key');
  }
  return k;
}

export function upsertProductCategory(input, { isNew = false } = {}) {
  const db = getDb();
  ensureCategoryTables(db);
  const key = assertKey(input.key);
  const name = String(input.name || '').trim();
  if (!name) throw new Error('missing_category_name');
  const existing = db.prepare('SELECT key FROM product_categories WHERE key = ?').get(key);
  if (isNew && existing) throw new Error('already_exists');
  if (!isNew && !existing) throw new Error('not_found');

  const prev = existing
    ? db.prepare('SELECT * FROM product_categories WHERE key = ?').get(key)
    : null;

  db.prepare(
    `INSERT INTO product_categories (key, name, name_en, filter_key_en, sort_order, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       name=excluded.name, name_en=excluded.name_en, filter_key_en=excluded.filter_key_en,
       sort_order=excluded.sort_order, updated_at=datetime('now')`
  ).run(
    key,
    name,
    String(input.nameEn || '').trim(),
    String(input.filterKeyEn || input.filter_key_en || key).trim() || key,
    Number(input.sortOrder != null ? input.sortOrder : input.sort_order) || 0
  );

  // Keep product.category display name in sync when renaming
  if (prev && prev.name !== name) {
    db.prepare(
      `UPDATE products SET category_key = ?, updated_at = datetime('now')
       WHERE filter_key = ?`
    ).run(name, key);
  }
  db.prepare(
    `UPDATE products SET filter_key_en = ?, category_key = ?, updated_at = datetime('now')
     WHERE filter_key = ?`
  ).run(
    String(input.filterKeyEn || input.filter_key_en || key).trim() || key,
    name,
    key
  );

  syncProductPageFilters();
  try {
    regenerateCatalogJs('products', 'zh');
    markStale('products');
  } catch (_) { /* ignore if empty */ }
  return listProductCategories().find((c) => c.key === key);
}

export function deleteProductCategory(key) {
  const db = getDb();
  ensureCategoryTables(db);
  const k = assertKey(key);
  const row = db.prepare('SELECT * FROM product_categories WHERE key = ?').get(k);
  if (!row) throw new Error('not_found');
  const used = db
    .prepare(
      `SELECT COUNT(*) AS c FROM products WHERE filter_key = ? OR category_key = ?`
    )
    .get(k, row.name)?.c || 0;
  if (used > 0) throw new Error('category_in_use');
  db.prepare('DELETE FROM product_categories WHERE key = ?').run(k);
  syncProductPageFilters();
  return { ok: true, deleted: k };
}

export function upsertSolutionCategory(input, { isNew = false } = {}) {
  const db = getDb();
  ensureCategoryTables(db);
  const key = assertKey(input.key);
  const name = String(input.name || '').trim();
  if (!name) throw new Error('missing_category_name');
  const existing = db.prepare('SELECT key FROM solution_categories WHERE key = ?').get(key);
  if (isNew && existing) throw new Error('already_exists');
  if (!isNew && !existing) throw new Error('not_found');

  const prev = existing
    ? db.prepare('SELECT * FROM solution_categories WHERE key = ?').get(key)
    : null;

  db.prepare(
    `INSERT INTO solution_categories (key, name, name_en, filter_key_en, sort_order, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       name=excluded.name, name_en=excluded.name_en, filter_key_en=excluded.filter_key_en,
       sort_order=excluded.sort_order, updated_at=datetime('now')`
  ).run(
    key,
    name,
    String(input.nameEn || '').trim(),
    String(input.filterKeyEn || input.filter_key_en || key).trim() || key,
    Number(input.sortOrder != null ? input.sortOrder : input.sort_order) || 0
  );

  if (prev && prev.name !== name) {
    db.prepare(
      `UPDATE solutions SET category_key = ?, updated_at = datetime('now')
       WHERE filter_key = ?`
    ).run(name, key);
  }
  db.prepare(
    `UPDATE solutions SET filter_key_en = ?, category_key = ?, updated_at = datetime('now')
     WHERE filter_key = ?`
  ).run(
    String(input.filterKeyEn || input.filter_key_en || key).trim() || key,
    name,
    key
  );

  syncSolutionPageFilters();
  try {
    regenerateCatalogJs('solutions', 'zh');
    markStale('solutions');
  } catch (_) { /* ignore if empty */ }
  return listSolutionCategories().find((c) => c.key === key);
}

export function deleteSolutionCategory(key) {
  const db = getDb();
  ensureCategoryTables(db);
  const k = assertKey(key);
  const row = db.prepare('SELECT * FROM solution_categories WHERE key = ?').get(k);
  if (!row) throw new Error('not_found');
  const used = db
    .prepare(
      `SELECT COUNT(*) AS c FROM solutions WHERE filter_key = ? OR category_key = ?`
    )
    .get(k, row.name)?.c || 0;
  if (used > 0) throw new Error('category_in_use');
  db.prepare('DELETE FROM solution_categories WHERE key = ?').run(k);
  syncSolutionPageFilters();
  return { ok: true, deleted: k };
}

export function upsertNewsCategory(input, { isNew = false } = {}) {
  const db = getDb();
  ensureCategoryTables(db);
  const key = assertKey(input.key);
  const name = String(input.name || '').trim();
  if (!name) throw new Error('missing_category_name');
  const existing = db.prepare('SELECT key FROM news_categories WHERE key = ?').get(key);
  if (isNew && existing) throw new Error('already_exists');
  if (!isNew && !existing) throw new Error('not_found');

  const prev = existing
    ? db.prepare('SELECT * FROM news_categories WHERE key = ?').get(key)
    : null;

  db.prepare(
    `INSERT INTO news_categories (key, name, sort_order, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       name=excluded.name, sort_order=excluded.sort_order, updated_at=datetime('now')`
  ).run(key, name, Number(input.sortOrder != null ? input.sortOrder : input.sort_order) || 0);

  if (prev && prev.name !== name) {
    db.prepare(
      `UPDATE news_i18n SET category = ? WHERE lang = 'zh' AND category = ?`
    ).run(name, prev.name);
  }

  syncNewsPageFilters();
  try {
    regenerateCatalogJs('news', 'zh');
    markStale('news');
  } catch (_) { /* ignore */ }
  return listNewsCategories().find((c) => c.key === key);
}

export function deleteNewsCategory(key) {
  const db = getDb();
  ensureCategoryTables(db);
  const k = assertKey(key);
  const row = db.prepare('SELECT * FROM news_categories WHERE key = ?').get(k);
  if (!row) throw new Error('not_found');
  const used = db
    .prepare(
      `SELECT COUNT(*) AS c FROM news_i18n WHERE lang = 'zh' AND category = ?`
    )
    .get(row.name)?.c || 0;
  if (used > 0) throw new Error('category_in_use');
  db.prepare('DELETE FROM news_categories WHERE key = ?').run(k);
  syncNewsPageFilters();
  return { ok: true, deleted: k };
}

/** Rewrite pages/products filters from product_categories (zh/en/ru). */
export function syncProductPageFilters() {
  const cats = listProductCategories();
  const allLabels = { zh: '全部产品', en: 'All Products', ru: 'Все продукты' };
  let zhFilters = null;
  for (const lang of ['zh', 'en', 'ru']) {
    const page = readPageJson('products', lang) || {
      pageKey: 'products',
      lang,
      hero: {},
      filters: {},
      seo: {},
    };
    const oldFilters = page.filters || {};
    const filters = {};
    filters.all = oldFilters.all || allLabels[lang] || 'All Products';
    for (const c of cats) {
      // line/software (filterKeyEn='single') are not standalone tabs — their
      // products surface under "all" only, matching the zh hand-curated page.
      if (c.filterKeyEn === 'single') continue;
      if (lang === 'zh') {
        filters[c.key] = c.name;
      } else if (lang === 'en') {
        // en: preserve existing translation; fall back to name_en, then zh name
        filters[c.key] = oldFilters[c.key] || c.nameEn || c.name || c.key;
      } else {
        // ru: preserve existing ru translation; if old value is just the en
        // fallback (equals nameEn) or the zh name, use zh name instead so
        // translate sync picks it up from zh source rather than staying stuck.
        var oldRu = oldFilters[c.key];
        if (oldRu && oldRu !== c.nameEn && oldRu !== c.name) {
          filters[c.key] = oldRu;
        } else {
          filters[c.key] = c.name || c.nameEn || c.key;
        }
      }
    }
    page.filters = filters;
    page.pageKey = 'products';
    page.lang = lang;
    writePageJsonAny('products', lang, page);
    regeneratePageJs('products', lang);
    if (lang === 'zh') zhFilters = filters;
  }
  markStale('pages:products');
  return zhFilters;
}

export function syncNewsPageFilters() {
  const cats = listNewsCategories();
  const allLabels = { zh: '全部资讯', en: 'All News', ru: 'Все новости' };
  let zhFilters = null;
  for (const lang of ['zh', 'en', 'ru']) {
    const page = readPageJson('news', lang) || {
      pageKey: 'news',
      lang,
      hero: {},
      filters: {},
      seo: {},
    };
    const oldFilters = page.filters || {};
    const filters = {};
    filters.all = oldFilters.all || allLabels[lang] || 'All News';
    for (const c of cats) {
      if (lang === 'zh') {
        filters[c.key] = c.name;
      } else {
        // news categories have no name_en column; preserve existing
        // translation, otherwise fall back to zh name so translate sync
        // picks it up from the zh source.
        var oldVal = oldFilters[c.key];
        if (oldVal && oldVal !== c.name) {
          filters[c.key] = oldVal;
        } else {
          filters[c.key] = c.name || c.key;
        }
      }
    }
    page.filters = filters;
    page.pageKey = 'news';
    page.lang = lang;
    writePageJsonAny('news', lang, page);
    regeneratePageJs('news', lang);
    if (lang === 'zh') zhFilters = filters;
  }
  markStale('pages:news');
  return zhFilters;
}

export function syncSolutionPageFilters() {
  const cats = listSolutionCategories();
  const allLabels = { zh: '全部方案', en: 'All Solutions', ru: 'Все решения' };
  let zhFilters = null;
  for (const lang of ['zh', 'en', 'ru']) {
    const page = readPageJson('solutions', lang) || {
      pageKey: 'solutions',
      lang,
      hero: {},
      filters: {},
      pillars: [],
      seo: {},
    };
    const oldFilters = page.filters || {};
    const filters = {};
    filters.all = oldFilters.all || allLabels[lang] || 'All Solutions';
    for (const c of cats) {
      if (lang === 'zh') {
        filters[c.key] = c.name;
      } else if (lang === 'en') {
        // en: preserve existing translation; fall back to name_en, then zh name
        filters[c.key] = oldFilters[c.key] || c.nameEn || c.name || c.key;
      } else {
        // ru: preserve existing ru translation; if old value is just the en
        // fallback (equals nameEn), use zh name instead so translate sync
        // picks it up from zh source rather than staying stuck in English.
        var oldRu = oldFilters[c.key];
        if (oldRu && oldRu !== c.nameEn && oldRu !== c.name) {
          filters[c.key] = oldRu;
        } else {
          filters[c.key] = c.name || c.nameEn || c.key;
        }
      }
    }
    page.filters = filters;
    page.pageKey = 'solutions';
    page.lang = lang;
    writePageJsonAny('solutions', lang, page);
    regeneratePageJs('solutions', lang);
    if (lang === 'zh') zhFilters = filters;
  }
  markStale('pages:solutions');
  return zhFilters;
}

export function resolveProductCategoryFields(categoryKeyOrName) {
  const cats = listProductCategories();
  const hit =
    cats.find((c) => c.key === categoryKeyOrName) ||
    cats.find((c) => c.name === categoryKeyOrName);
  if (!hit) {
    return {
      category: categoryKeyOrName || '',
      filterKey: '',
      filterKeyEn: '',
    };
  }
  return {
    category: hit.name,
    filterKey: hit.key,
    filterKeyEn: hit.filterKeyEn || hit.key,
  };
}

export function resolveSolutionCategoryFields(categoryKeyOrName) {
  const cats = listSolutionCategories();
  const hit =
    cats.find((c) => c.key === categoryKeyOrName) ||
    cats.find((c) => c.name === categoryKeyOrName);
  if (!hit) {
    return {
      category: categoryKeyOrName || '',
      filterKey: '',
      filterKeyEn: '',
    };
  }
  return {
    category: hit.name,
    filterKey: hit.key,
    filterKeyEn: hit.filterKeyEn || hit.key,
  };
}
