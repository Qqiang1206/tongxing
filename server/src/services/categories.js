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
  invalidateCategoryMaps,
} from './catalog.js';
import { markStale } from './translationStatus.js';
import { getTermTranslation } from './translationMemory.js';

const PRODUCT_SEED = [
  { key: 'optical', name: '光学元件组装', nameEn: 'Optical Assembly', nameRu: 'Сборка оптики', filterKeyEn: 'optical', sortOrder: 10 },
  { key: 'dispensing', name: '点胶装配', nameEn: 'Dispensing', nameRu: 'Дозирование', filterKeyEn: 'dispensing', sortOrder: 20 },
  { key: 'flip', name: '翻转检测', nameEn: 'Flip Detection', nameRu: 'Контроль переворота', filterKeyEn: 'flip', sortOrder: 30 },
  { key: 'screw', name: '锁付组装', nameEn: 'Screw Assembly', nameRu: 'Винтовая сборка', filterKeyEn: 'screw', sortOrder: 40 },
  { key: 'transfer', name: '搬运移载', nameEn: 'Transfer', nameRu: 'Перемещение', filterKeyEn: 'transfer', sortOrder: 50 },
  { key: 'packaging', name: '后段包装', nameEn: 'Packaging', nameRu: 'Упаковка', filterKeyEn: 'packaging', sortOrder: 60 },
  { key: 'robot', name: '机器人集成', nameEn: 'Robot Integration', nameRu: 'Робототехника', filterKeyEn: 'robot', sortOrder: 70 },
  { key: 'line', name: '整线交付', nameEn: 'Production Lines', nameRu: 'Линии под ключ', filterKeyEn: 'single', sortOrder: 80 },
  { key: 'software', name: '软件控制', nameEn: 'Software & Control', nameRu: 'ПО и управление', filterKeyEn: 'single', sortOrder: 90 },
];

const NEWS_SEED = [
  { key: 'company', name: '公司新闻', sortOrder: 10 },
  { key: 'project', name: '项目故事', sortOrder: 20 },
  { key: 'industry', name: '行业洞察', sortOrder: 30 },
];

const SOLUTION_SEED = [
  { key: 'tv-display', name: 'TV / 商显', nameEn: 'TV & Commercial Display', nameRu: 'ТВ и коммерческие дисплеи', filterKeyEn: 'tv-display', sortOrder: 10 },
  { key: 'refrigerator', name: '冰箱', nameEn: 'Refrigerator', nameRu: 'Бытовая техника', filterKeyEn: 'refrigerator', sortOrder: 20 },
  { key: 'packaging', name: '包装', nameEn: 'Packaging', nameRu: 'Логистика и упаковка', filterKeyEn: 'packaging', sortOrder: 30 },
  { key: 'washer', name: '洗衣机', nameEn: 'Washer', nameRu: '3C-электроника', filterKeyEn: 'washer', sortOrder: 40 },
  { key: 'capacitor', name: '电容', nameEn: 'Capacitor', nameRu: 'Накопители энергии', filterKeyEn: 'capacitor', sortOrder: 50 },
  { key: 'ac', name: '空调', nameEn: 'Air Conditioning', nameRu: 'Автомобильная отрасль', filterKeyEn: 'ac', sortOrder: 60 },
  { key: 'microwave', name: '微波炉', nameEn: 'Microwave', nameRu: 'Микроволновые печи', filterKeyEn: 'microwave', sortOrder: 70 },
  { key: 'coffee', name: '咖啡机', nameEn: 'Coffee Machine', nameRu: 'Кофемашины', filterKeyEn: 'coffee', sortOrder: 80 },
  { key: 'tablet', name: '平板', nameEn: 'Tablet', nameRu: 'Планшеты', filterKeyEn: 'tablet', sortOrder: 90 },
  { key: 'headlight', name: '车灯', nameEn: 'Headlight', nameRu: 'Автомобильные фары', filterKeyEn: 'headlight', sortOrder: 100 },
  { key: 'robot', name: '机器人', nameEn: 'Robot', nameRu: 'Робототехника', filterKeyEn: 'robot', sortOrder: 110 },
];

let _pageFiltersSynced = false;
export function ensureCategoryTables(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS product_categories (
      key TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_en TEXT DEFAULT '',
      name_ru TEXT DEFAULT '',
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
      name_ru TEXT DEFAULT '',
      filter_key_en TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  // Additive migration: name_ru for pre-existing DBs
  for (const table of ['product_categories', 'solution_categories']) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes('name_ru')) db.exec(`ALTER TABLE ${table} ADD COLUMN name_ru TEXT DEFAULT ''`);
    // name_*_src 记录"该译文是哪一个中文名的译文"。中文名一改，译文即过期，
    // 页面筛选会回落到中文并交给翻译重新生成，避免旧英文被永久锁死。
    if (!cols.includes('name_en_src')) db.exec(`ALTER TABLE ${table} ADD COLUMN name_en_src TEXT DEFAULT ''`);
    if (!cols.includes('name_ru_src')) db.exec(`ALTER TABLE ${table} ADD COLUMN name_ru_src TEXT DEFAULT ''`);
  }
  seedIfEmpty(db);
  backfillNameRu(db);
  backfillTranslationSource(db);
  if (!_pageFiltersSynced) {
    _pageFiltersSynced = true;
    try {
      syncProductPageFilters();
      syncNewsPageFilters();
      syncSolutionPageFilters();
    } catch (_) { /* page json may not exist yet */ }
  }
}

/** One-time backfill: populate name_ru from seed data for existing DBs. */
function backfillNameRu(db) {
  const empty = db.prepare(
    `SELECT COUNT(*) AS c FROM product_categories WHERE name_ru IS NULL OR name_ru = ''`
  ).get()?.c || 0;
  if (empty > 0) {
    const upd = db.prepare(`UPDATE product_categories SET name_ru = ? WHERE key = ?`);
    for (const row of PRODUCT_SEED) {
      if (row.nameRu) upd.run(row.nameRu, row.key);
    }
  }
  const emptyS = db.prepare(
    `SELECT COUNT(*) AS c FROM solution_categories WHERE name_ru IS NULL OR name_ru = ''`
  ).get()?.c || 0;
  if (emptyS > 0) {
    const upd = db.prepare(`UPDATE solution_categories SET name_ru = ? WHERE key = ?`);
    for (const row of SOLUTION_SEED) {
      if (row.nameRu) upd.run(row.nameRu, row.key);
    }
  }
}

/**
 * 迁移：为已有译文补上"来源中文名"。既有译文视为跟随当前中文名，
 * 这样历史数据不会被误判为过期而大面积回落中文。
 */
function backfillTranslationSource(db) {
  for (const table of ['product_categories', 'solution_categories']) {
    for (const lang of ['en', 'ru']) {
      db.prepare(
        `UPDATE ${table}
            SET name_${lang}_src = name
          WHERE (name_${lang}_src IS NULL OR name_${lang}_src = '')
            AND name_${lang} IS NOT NULL AND name_${lang} <> ''`
      ).run();
    }
  }
}

function seedIfEmpty(db) {
  const pc = db.prepare('SELECT COUNT(*) AS c FROM product_categories').get()?.c || 0;
  if (pc === 0) {
    const ins = db.prepare(
      `INSERT INTO product_categories (key, name, name_en, name_ru, filter_key_en, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const row of PRODUCT_SEED) {
      ins.run(row.key, row.name, row.nameEn, row.nameRu || '', row.filterKeyEn, row.sortOrder);
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
      `INSERT INTO solution_categories (key, name, name_en, name_ru, filter_key_en, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const row of SOLUTION_SEED) {
      ins.run(row.key, row.name, row.nameEn, row.nameRu || '', row.filterKeyEn, row.sortOrder);
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
    nameRu: r.name_ru || '',
    nameEnSrc: r.name_en_src || '',
    nameRuSrc: r.name_ru_src || '',
    filterKeyEn: r.filter_key_en || r.key,
    sortOrder: Number(r.sort_order) || 0,
  };
}

function rowSolution(r) {
  return {
    key: r.key,
    name: r.name,
    nameEn: r.name_en || '',
    nameRu: r.name_ru || '',
    nameEnSrc: r.name_en_src || '',
    nameRuSrc: r.name_ru_src || '',
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

/**
 * 计算译文的"来源中文名"标记。
 * - 本次显式提供了译名 → 该译名跟随当前中文名；
 * - 中文名被改掉且未提供新译名 → 置空，标记旧译文过期（页面回落中文后重新翻译）；
 * - 其余情况沿用原标记。
 */
function srcFor(lang, input, name, prev) {
  const provided = lang === 'en'
    ? String(input.nameEn || '').trim()
    : String(input.nameRu || input.name_ru || '').trim();
  if (provided) return name;
  if (prev && prev.name !== name) return '';
  return (prev && prev[`name_${lang}_src`]) || '';
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
    `INSERT INTO product_categories (key, name, name_en, name_ru, filter_key_en, sort_order, name_en_src, name_ru_src, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       name=excluded.name, name_en=excluded.name_en, name_ru=excluded.name_ru,
       filter_key_en=excluded.filter_key_en,
       name_en_src=excluded.name_en_src, name_ru_src=excluded.name_ru_src,
       sort_order=excluded.sort_order, updated_at=datetime('now')`
  ).run(
    key,
    name,
    String(input.nameEn || '').trim(),
    String(input.nameRu || input.name_ru || '').trim(),
    String(input.filterKeyEn || input.filter_key_en || key).trim() || key,
    Number(input.sortOrder != null ? input.sortOrder : input.sort_order) || 0,
    srcFor('en', input, name, prev),
    srcFor('ru', input, name, prev)
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
  invalidateCategoryMaps();
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
  invalidateCategoryMaps();
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
    `INSERT INTO solution_categories (key, name, name_en, name_ru, filter_key_en, sort_order, name_en_src, name_ru_src, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET
       name=excluded.name, name_en=excluded.name_en, name_ru=excluded.name_ru,
       filter_key_en=excluded.filter_key_en,
       name_en_src=excluded.name_en_src, name_ru_src=excluded.name_ru_src,
       sort_order=excluded.sort_order, updated_at=datetime('now')`
  ).run(
    key,
    name,
    String(input.nameEn || '').trim(),
    String(input.nameRu || input.name_ru || '').trim(),
    String(input.filterKeyEn || input.filter_key_en || key).trim() || key,
    Number(input.sortOrder != null ? input.sortOrder : input.sort_order) || 0,
    srcFor('en', input, name, prev),
    srcFor('ru', input, name, prev)
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
  invalidateCategoryMaps();
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
  invalidateCategoryMaps();
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

/**
 * 分类名的本地化取值。中文是后台唯一真源，en/ru 只能来自翻译产物：
 *   1) 翻译术语库（translation_memory.term）—— 最权威，跨页面复用同一译法；
 *   2) 分类表里跟随当前中文名的缓存译名（name_en / name_ru）；
 *   3) 都没有 → 回落中文，让翻译调度接管。
 * 旧实现会在 en 分支无条件沿用页面里已有的旧值，导致中文名改掉之后
 * 英文被永久锁死（例如"冰箱"改成"家电"后英文仍是 Refrigerator）。
 */
function localizedCategoryName(cat, lang, oldValue) {
  if (!cat) return '';
  if (lang === 'zh') return cat.name || cat.key || '';
  const term = getTermTranslation(cat.name, lang);
  if (term) return term;
  const cached = lang === 'en' ? cat.nameEn : cat.nameRu;
  const src = lang === 'en' ? cat.nameEnSrc : cat.nameRuSrc;
  if (src === cat.name) {
    // 中文名没变：页面里已有的译名多为翻译产物，比分类表里的初始缓存更新，
    // 优先沿用，避免把线上文案打回 seed 时代的短名。
    return oldValue || cached || cat.name || cat.key || '';
  }
  // 中文名已被改掉：旧译名一律作废，回落中文让翻译重新生成。
  return cat.name || cat.key || '';
}

/** 翻译术语库里有权威译法时，回填分类表，别让分类表停留在旧值。 */
function backfillCategoryTranslations(table, cats) {
  if (!cats.length) return;
  const db = getDb();
  for (const lang of ['en', 'ru']) {
    const upd = db.prepare(
      `UPDATE ${table} SET name_${lang} = ?, name_${lang}_src = ?, updated_at = datetime('now') WHERE key = ?`
    );
    for (const c of cats) {
      const term = getTermTranslation(c.name, lang);
      if (!term) continue;
      const cached = lang === 'en' ? c.nameEn : c.nameRu;
      const src = lang === 'en' ? c.nameEnSrc : c.nameRuSrc;
      if (cached !== term || src !== c.name) upd.run(term, c.name, c.key);
    }
  }
}

/** Rewrite pages/products filters from product_categories (zh/en/ru). */
export function syncProductPageFilters() {
  const cats = listProductCategories();
  backfillCategoryTranslations('product_categories', cats);
  // Count published products per filter_key so categories with no visible
  // product don't get a filter tab on the products list page.
  const productCounts = {};
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT filter_key AS k, COUNT(*) AS c FROM products WHERE published = 1 GROUP BY filter_key`
      )
      .all();
    for (const r of rows) productCounts[r.k || ''] = r.c;
  } catch {
    /* products table may not exist yet during seed — treat as empty */
  }
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
      // Skip categories with no published product — they would render as empty tabs.
      if (!productCounts[c.key]) continue;
      if (lang === 'zh') {
        filters[c.key] = c.name;
      } else {
        filters[c.key] = localizedCategoryName(c, lang, oldFilters[c.key]);
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
  // Count published news per category name so categories with no visible
  // news item don't get a filter tab on the news list page.
  const newsCounts = {};
  try {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT i.category AS name, COUNT(*) AS c
         FROM news_i18n i
         JOIN news n ON n.id = i.news_id
         WHERE i.lang = 'zh' AND n.published = 1
         GROUP BY i.category`
      )
      .all();
    for (const r of rows) newsCounts[r.name || ''] = r.c;
  } catch {
    /* news tables may not exist yet during seed — treat as empty */
  }
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
      // Skip categories with no published news — they would render as empty tabs.
      if (!newsCounts[c.name]) continue;
      if (lang === 'zh') {
        filters[c.key] = c.name;
      } else {
        // 新闻分类没有独立的译名列：术语库优先，其次沿用已有译文，
        // 都没有则回落中文交给翻译。
        const oldVal = oldFilters[c.key];
        const term = getTermTranslation(c.name, lang);
        filters[c.key] = term || (oldVal && oldVal !== c.name ? oldVal : c.name || c.key);
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
  backfillCategoryTranslations('solution_categories', cats);
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
      } else {
        filters[c.key] = localizedCategoryName(c, lang, oldFilters[c.key]);
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

export function resolveNewsCategoryFields(categoryKeyOrName) {
  const cats = listNewsCategories();
  const hit =
    cats.find((c) => c.key === categoryKeyOrName) ||
    cats.find((c) => c.name === categoryKeyOrName);
  if (!hit) {
    return {
      category: categoryKeyOrName || '',
      categoryKey: '',
    };
  }
  return {
    category: hit.name,
    categoryKey: hit.key,
  };
}
