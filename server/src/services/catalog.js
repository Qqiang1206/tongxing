/**
 * Catalog / pages / site — SQLite-backed.
 * Optional JSON/JS export keeps static front-end fallback in sync (SYNC_JSON_ON_WRITE=1 default).
 */
import fs from 'fs';
import path from 'path';
import { DATA_DIR, REPO_ROOT, LANGS, parseLang } from '../config.js';
import { mapProduct, mapSolution, mapNews, toCatalogMap } from '../mappers/toApi.js';
import { getDb } from '../db.js';
import { removeItemSnapshot } from './translationSnapshot.js';
import { sanitizeContentHtml } from './sanitizeHtml.js';
const toJsLiteral = (value) => JSON.stringify(value).replace(/</g, '\\u003c');

import { assertSolutionHomeSlot, assertNewsHomeFeatured, reconcileHomeSlots, guardRequiredSlotVacate } from './homeSlots.js';
import { clearPublicCache } from './publicCache.js';

export const SOLUTION_SLUG_BY_ID = {
  '31': 'tv-display',
  '32': 'refrigerator',
  '33': 'packaging',
  '34': 'washer',
  '35': 'capacitor',
  '36': 'ac',
  '37': 'microwave',
  '38': 'coffee',
  '39': 'tablet',
  '40': 'headlight',
  '41': 'robot',
};

const SLUG_TO_ID = Object.fromEntries(
  Object.entries(SOLUTION_SLUG_BY_ID).map(([id, slug]) => [slug, id])
);

const CATALOG_JS_GLOBALS = {
  products: '__TXAM_PRODUCTS',
  news: '__TXAM_NEWS',
  solutions: '__TXAM_SOLUTIONS',
};

const SLIM_OMIT = {
  products: ['contentHtml', 'detail'],
  solutions: ['contentHtml', 'detail', 'painPoints', 'process'],
  news: ['contentHtml', 'content'],
};

function slimCatalogItem(kind, item) {
  const omit = new Set(SLIM_OMIT[kind] || []);
  const out = {};
  for (const [key, value] of Object.entries(item || {})) {
    if (!omit.has(key)) out[key] = value;
  }
  return out;
}

function slimCatalogMap(kind, data) {
  const out = {};
  for (const [id, item] of Object.entries(data || {})) {
    out[id] = slimCatalogItem(kind, item);
  }
  return out;
}

function syncJsonEnabled() {
  const v = process.env.SYNC_JSON_ON_WRITE;
  if (v == null || v === '') return true;
  return !['0', 'false', 'no'].includes(String(v).toLowerCase());
}

function jsonStr(v, fallback = null) {
  if (v == null) return fallback;
  return typeof v === 'string' ? v : JSON.stringify(v);
}

function parseJson(v, fallback) {
  if (v == null || v === '') return fallback;
  try {
    return JSON.parse(v);
  } catch {
    return fallback;
  }
}

function publishedInt(v) {
  return v === false || v === 0 || v === '0' ? 0 : 1;
}

/* ——— Public API shape (published only) ——— */

/** Build a filterKey→{name,nameEn,nameRu} map from the category table. */
let _productCatMap = null;
let _solutionCatMap = null;
function getCategoryMap(kind) {
  const db = getDb();
  const table = kind === 'products' ? 'product_categories' : 'solution_categories';
  try {
    const rows = db.prepare(`SELECT key, name, name_en, name_ru FROM ${table}`).all();
    const map = {};
    for (const r of rows) map[r.key] = { name: r.name, nameEn: r.name_en || '', nameRu: r.name_ru || '' };
    return map;
  } catch { return null; }
}
function productCategoryMap() {
  if (!_productCatMap) _productCatMap = getCategoryMap('products');
  return _productCatMap;
}
function solutionCategoryMap() {
  if (!_solutionCatMap) _solutionCatMap = getCategoryMap('solutions');
  return _solutionCatMap;
}
/** Invalidate cached category maps (call after category upsert). */
export function invalidateCategoryMaps() { _productCatMap = null; _solutionCatMap = null; }

function productApiFromRows(row, i18n, opts = {}) {
  return mapProduct(
    {
      id: row.id,
      category_key: row.category_key || '',
      model: row.model || '',
      image: row.image || '',
      published: !!row.published,
      show_in_list: row.show_in_list,
      sort_order: row.sort_order,
      filter_key: row.filter_key,
      filter_key_en: row.filter_key_en,
    },
    i18n,
    { ...opts, categoryMap: productCategoryMap() }
  );
}

function solutionApiFromRows(row, i18n, opts = {}) {
  return mapSolution(
    {
      id: row.id,
      slug: row.slug || SOLUTION_SLUG_BY_ID[row.id] || row.id,
      category_key: row.category_key || '',
      image: row.image || '',
      published: !!row.published,
      sort_order: row.sort_order,
      home_slot: row.home_slot || '',
      filter_key: row.filter_key,
      filter_key_en: row.filter_key_en,
    },
    i18n,
    { ...opts, categoryMap: solutionCategoryMap() }
  );
}

function newsApiFromRows(row, i18n, opts = {}) {
  return mapNews(
    {
      id: row.id,
      cover: row.cover || '',
      category_key: row.category_key || '',
      published_at: row.published_at || '',
      published: !!row.published,
      sort_order: row.sort_order,
      home_featured: row.home_featured,
    },
    i18n,
    opts
  );
}

function getAllProducts(lang) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.*, i.name, i.summary, i.specs_json, i.model AS i18n_model
       FROM products p
       JOIN product_i18n i ON i.product_id = p.id AND i.lang = ?
       WHERE p.published = 1
         AND (? = 'zh' OR i.translation_status != 'missing')
       ORDER BY p.sort_order, CAST(p.id AS INTEGER)`
    )
    .all(lang, lang);
  return toCatalogMap(
    rows.map((r) =>
      productApiFromRows(
        r,
        {
          name: r.name,
          summary: r.summary,
          specs_json: r.specs_json,
          model: r.i18n_model,
        },
        { slim: true, lang }
      )
    )
  );
}

function getProductById(id, lang) {
  const db = getDb();
  const r = db
    .prepare(
      `SELECT p.*, i.name, i.summary, i.content_html, i.specs_json, i.model AS i18n_model
       FROM products p
       JOIN product_i18n i ON i.product_id = p.id AND i.lang = ?
       WHERE p.id = ? AND p.published = 1
         AND (? = 'zh' OR i.translation_status != 'missing')`
    )
    .get(lang, String(id), lang);
  if (!r) return null;
  return productApiFromRows(r, {
    name: r.name,
    summary: r.summary,
    content_html: r.content_html,
    specs_json: r.specs_json,
    model: r.i18n_model,
  }, { lang });
}

function getAllSolutions(lang) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.*, i.name, i.summary, i.specs_json
       FROM solutions s
       JOIN solution_i18n i ON i.solution_id = s.id AND i.lang = ?
       WHERE s.published = 1
         AND (? = 'zh' OR i.translation_status != 'missing')
       ORDER BY s.sort_order, CAST(s.id AS INTEGER)`
    )
    .all(lang, lang);
  return toCatalogMap(
    rows.map((r) =>
      solutionApiFromRows(
        r,
        {
          name: r.name,
          summary: r.summary,
          specs_json: r.specs_json,
        },
        { slim: true, lang }
      )
    )
  );
}

function getSolutionById(id, lang) {
  const db = getDb();
  const r = db
    .prepare(
      `SELECT s.*, i.name, i.summary, i.content_html, i.specs_json, i.pain_points_json, i.process_json
       FROM solutions s
       JOIN solution_i18n i ON i.solution_id = s.id AND i.lang = ?
       WHERE s.id = ? AND s.published = 1
         AND (? = 'zh' OR i.translation_status != 'missing')`
    )
    .get(lang, String(id), lang);
  if (!r) return null;
  return solutionApiFromRows(r, {
    name: r.name,
    summary: r.summary,
    content_html: r.content_html,
    specs_json: r.specs_json,
    pain_points_json: r.pain_points_json,
    process_json: r.process_json,
  }, { lang });
}

function getAllNews(lang) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT n.*, i.category, i.title, i.content_html, i.date_display
       FROM news n
       JOIN news_i18n i ON i.news_id = n.id AND i.lang = ?
       WHERE n.published = 1
         AND (? = 'zh' OR i.translation_status != 'missing')
       ORDER BY n.sort_order, n.published_at DESC, CAST(n.id AS INTEGER)`
    )
    .all(lang, lang);
  return toCatalogMap(
    rows.map((r) =>
      newsApiFromRows(
        r,
        {
          category: r.category,
          title: r.title,
          content_html: r.content_html,
          date_display: r.date_display,
        },
        { slim: true }
      )
    )
  );
}

function getNewsById(id, lang) {
  const db = getDb();
  const r = db
    .prepare(
      `SELECT n.*, i.category, i.title, i.content_html, i.date_display
       FROM news n
       JOIN news_i18n i ON i.news_id = n.id AND i.lang = ?
       WHERE n.id = ? AND n.published = 1
         AND (? = 'zh' OR i.translation_status != 'missing')`
    )
    .get(lang, String(id), lang);
  if (!r) return null;
  return newsApiFromRows(r, {
    category: r.category,
    title: r.title,
    content_html: r.content_html,
    date_display: r.date_display,
  });
}

function getSlottedSolutions(lang) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.*, i.name, i.summary, i.specs_json
       FROM solutions s
       JOIN solution_i18n i ON i.solution_id = s.id AND i.lang = ?
       WHERE s.published = 1
         AND s.home_slot IN ('hero', 'category')
         AND (? = 'zh' OR i.translation_status != 'missing')
       ORDER BY s.sort_order, CAST(s.id AS INTEGER)`
    )
    .all(lang, lang);
  return toCatalogMap(
    rows.map((r) =>
      solutionApiFromRows(
        r,
        { name: r.name, summary: r.summary, specs_json: r.specs_json },
        { slim: true }
      )
    )
  );
}

function getFeaturedNews(lang) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT n.*, i.category, i.title, i.content_html, i.date_display
       FROM news n
       JOIN news_i18n i ON i.news_id = n.id AND i.lang = ?
       WHERE n.published = 1
         AND n.home_featured = 1
         AND (? = 'zh' OR i.translation_status != 'missing')
       ORDER BY n.sort_order, n.published_at DESC, CAST(n.id AS INTEGER)`
    )
    .all(lang, lang);
  return toCatalogMap(
    rows.map((r) =>
      newsApiFromRows(
        r,
        {
          category: r.category,
          title: r.title,
          content_html: r.content_html,
          date_display: r.date_display,
        },
        { slim: true }
      )
    )
  );
}

/** Homepage aggregate: page copy + only slotted solutions/news (list-slim). */
function getHomeBundle(lang) {
  const page = readPageJson('home', lang);
  if (!page) return null;
  return {
    page,
    solutions: getSlottedSolutions(lang),
    news: getFeaturedNews(lang),
    lang,
  };
}

export function loadSiteSettings(lang) {
  const db = getDb();
  const row = db.prepare('SELECT settings_json FROM site_settings WHERE lang = ?').get(lang);
  if (!row) {
    // fallback empty
    return {};
  }
  return parseJson(row.settings_json, {});
}

export function readPageJson(pageKey, lang) {
  const db = getDb();
  const row = db
    .prepare('SELECT seo_json, sections_json FROM pages WHERE page_key = ? AND lang = ?')
    .get(pageKey, lang);
  if (!row) return null;
  const sections = parseJson(row.sections_json, {});
  const seo = parseJson(row.seo_json, null);
  const page = { ...sections, pageKey, lang };
  if (seo) page.seo = seo;
  return page;
}

export const catalog = {
  parseLang,
  loadSiteSettings,
  loadPage(pageKey, lang) {
    return readPageJson(pageKey, lang);
  },
  getHomeBundle,
  getProductById,
  getAllProducts,
  getSolutionById,
  getSolutionBySlug(slug, lang) {
    const db = getDb();
    const bySlug = db.prepare('SELECT id FROM solutions WHERE slug = ?').get(slug);
    const id = bySlug?.id || SLUG_TO_ID[slug];
    if (!id) return null;
    return getSolutionById(id, lang);
  },
  getAllSolutions,
  getNewsById,
  getAllNews,
};

/* ——— Admin raw (zh flat objects) ——— */

function rowToProductRaw(p, i, opts = {}) {
  const catMap = opts.lang && opts.lang !== 'zh' ? productCategoryMap() : null;
  const cat = catMap && p.filter_key && catMap[p.filter_key];
  const category = cat
    ? (opts.lang === 'en' ? cat.nameEn || cat.name : opts.lang === 'ru' ? cat.nameRu || cat.name : cat.name)
    : (p.category_key || '');
  return {
    id: p.id,
    category,
    model: i?.model || p.model || '',
    name: i?.name || '',
    image: p.image || '',
    specs: parseJson(i?.specs_json, []),
    summary: i?.summary || '',
    contentHtml: i?.content_html || '',
    published: !!p.published,
    showInList: p.show_in_list == null ? true : !!Number(p.show_in_list),
    sortOrder: Number(p.sort_order) || 0,
    filterKey: p.filter_key || '',
    filterKeyEn: p.filter_key_en || '',
    slug: p.slug || '',
    updatedAt: p.updated_at || '',
  };
}

function rowToSolutionRaw(s, i, opts = {}) {
  const catMap = opts.lang && opts.lang !== 'zh' ? solutionCategoryMap() : null;
  const cat = catMap && s.filter_key && catMap[s.filter_key];
  const category = cat
    ? (opts.lang === 'en' ? cat.nameEn || cat.name : opts.lang === 'ru' ? cat.nameRu || cat.name : cat.name)
    : (s.category_key || '');
  const out = {
    id: s.id,
    category,
    name: i?.name || '',
    image: s.image || '',
    specs: parseJson(i?.specs_json, []),
    summary: i?.summary || '',
    contentHtml: i?.content_html || '',
    published: !!s.published,
    slug: s.slug || SOLUTION_SLUG_BY_ID[s.id] || '',
    sortOrder: Number(s.sort_order) || 0,
    homeSlot: s.home_slot === 'hero' || s.home_slot === 'category' ? s.home_slot : '',
    filterKey: s.filter_key || '',
    filterKeyEn: s.filter_key_en || '',
    updatedAt: s.updated_at || '',
  };
  const pain = parseJson(i?.pain_points_json, null);
  const process = parseJson(i?.process_json, null);
  if (pain) out.painPoints = pain;
  if (process) out.process = process;
  return out;
}

function rowToNewsRaw(n, i) {
  return {
    id: n.id,
    category: i?.category || '',
    categoryKey: n.category_key || '',
    title: i?.title || '',
    date: i?.date_display || n.published_at || '',
    cover: n.cover || '',
    contentHtml: i?.content_html || '',
    published: !!n.published,
    sortOrder: Number(n.sort_order) || 0,
    slug: n.slug || '',
    homeFeatured: !!Number(n.home_featured),
    updatedAt: n.updated_at || '',
  };
}

export function listCatalogItemsRaw(kind) {
  const db = getDb();
  if (kind === 'products') {
    return db
      .prepare(
        `SELECT p.*, i.name, i.summary, i.content_html, i.specs_json
         FROM products p
         LEFT JOIN product_i18n i ON i.product_id = p.id AND i.lang = 'zh'
         ORDER BY p.sort_order, CAST(p.id AS INTEGER)`
      )
      .all()
      .map((r) =>
        rowToProductRaw(r, {
          name: r.name,
          summary: r.summary,
          content_html: r.content_html,
          specs_json: r.specs_json,
        })
      );
  }
  if (kind === 'solutions') {
    return db
      .prepare(
        `SELECT s.*, i.name, i.summary, i.content_html, i.specs_json, i.pain_points_json, i.process_json
         FROM solutions s
         LEFT JOIN solution_i18n i ON i.solution_id = s.id AND i.lang = 'zh'
         ORDER BY s.sort_order, CAST(s.id AS INTEGER)`
      )
      .all()
      .map((r) =>
        rowToSolutionRaw(r, {
          name: r.name,
          summary: r.summary,
          content_html: r.content_html,
          specs_json: r.specs_json,
          pain_points_json: r.pain_points_json,
          process_json: r.process_json,
        })
      );
  }
  if (kind === 'news') {
    return db
      .prepare(
        `SELECT n.*, i.category, i.title, i.content_html, i.date_display
         FROM news n
         LEFT JOIN news_i18n i ON i.news_id = n.id AND i.lang = 'zh'
         ORDER BY n.sort_order, CAST(n.id AS INTEGER)`
      )
      .all()
      .map((r) =>
        rowToNewsRaw(r, {
          category: r.category,
          title: r.title,
          content_html: r.content_html,
          date_display: r.date_display,
        })
      );
  }
  throw new Error('invalid_catalog_kind');
}

export function getCatalogItemRaw(kind, id) {
  const db = getDb();
  const key = String(id);
  if (kind === 'products') {
    const r = db
      .prepare(
        `SELECT p.*, i.name, i.summary, i.content_html, i.specs_json
         FROM products p
         LEFT JOIN product_i18n i ON i.product_id = p.id AND i.lang = 'zh'
         WHERE p.id = ?`
      )
      .get(key);
    return r
      ? rowToProductRaw(r, {
          name: r.name,
          summary: r.summary,
          content_html: r.content_html,
          specs_json: r.specs_json,
        })
      : null;
  }
  if (kind === 'solutions') {
    const r = db
      .prepare(
        `SELECT s.*, i.name, i.summary, i.content_html, i.specs_json, i.pain_points_json, i.process_json
         FROM solutions s
         LEFT JOIN solution_i18n i ON i.solution_id = s.id AND i.lang = 'zh'
         WHERE s.id = ?`
      )
      .get(key);
    return r
      ? rowToSolutionRaw(r, {
          name: r.name,
          summary: r.summary,
          content_html: r.content_html,
          specs_json: r.specs_json,
          pain_points_json: r.pain_points_json,
          process_json: r.process_json,
        })
      : null;
  }
  if (kind === 'news') {
    const r = db
      .prepare(
        `SELECT n.*, i.category, i.title, i.content_html, i.date_display
         FROM news n
         LEFT JOIN news_i18n i ON i.news_id = n.id AND i.lang = 'zh'
         WHERE n.id = ?`
      )
      .get(key);
    return r
      ? rowToNewsRaw(r, {
          category: r.category,
          title: r.title,
          content_html: r.content_html,
          date_display: r.date_display,
        })
      : null;
  }
  throw new Error('invalid_catalog_kind');
}

export function listCatalogItemsRawSlim(kind) {
  return listCatalogItemsRaw(kind).map((item) => slimCatalogItem(kind, item));
}

export function readCatalogJson(kind, lang = 'zh') {
  const db = getDb();
  const out = {};
  if (kind === 'products') {
    const rows = db
      .prepare(
        `SELECT p.*, i.name, i.summary, i.content_html, i.specs_json, i.model AS i18n_model
         FROM products p
         JOIN product_i18n i ON i.product_id = p.id AND i.lang = ?
         WHERE p.published = 1 AND (? = 'zh' OR i.translation_status != 'missing')`
      )
      .all(lang, lang);
    for (const r of rows) {
      out[r.id] = rowToProductRaw(r, {
        name: r.name,
        summary: r.summary,
        content_html: r.content_html,
        specs_json: r.specs_json,
        model: r.i18n_model,
      }, { lang });
    }
  } else if (kind === 'solutions') {
    const rows = db
      .prepare(
        `SELECT s.*, i.name, i.summary, i.content_html, i.specs_json, i.pain_points_json, i.process_json
         FROM solutions s
         JOIN solution_i18n i ON i.solution_id = s.id AND i.lang = ?
         WHERE s.published = 1 AND (? = 'zh' OR i.translation_status != 'missing')`
      )
      .all(lang, lang);
    for (const r of rows) {
      out[r.id] = rowToSolutionRaw(r, {
        name: r.name,
        summary: r.summary,
        content_html: r.content_html,
        specs_json: r.specs_json,
        pain_points_json: r.pain_points_json,
        process_json: r.process_json,
      }, { lang });
    }
  } else if (kind === 'news') {
    const rows = db
      .prepare(
        `SELECT n.*, i.category, i.title, i.content_html, i.date_display
         FROM news n
         JOIN news_i18n i ON i.news_id = n.id AND i.lang = ?
         WHERE n.published = 1 AND (? = 'zh' OR i.translation_status != 'missing')`
      )
      .all(lang, lang);
    for (const r of rows) {
      out[r.id] = rowToNewsRaw(r, {
        category: r.category,
        title: r.title,
        content_html: r.content_html,
        date_display: r.date_display,
      });
    }
  } else {
    throw new Error('invalid_catalog_kind');
  }
  return out;
}

function upsertProductLang(db, id, lang, item, status) {
  const contentHtml = sanitizeContentHtml(item.contentHtml || item.detail || '');
  db.prepare(
    `INSERT INTO product_i18n (product_id, lang, name, summary, content_html, specs_json, model, translation_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(product_id, lang) DO UPDATE SET
       name=excluded.name, summary=excluded.summary, content_html=excluded.content_html,
       specs_json=excluded.specs_json, model=excluded.model, translation_status=excluded.translation_status,
       updated_at=datetime('now')`
  ).run(
    id,
    lang,
    item.name || '',
    item.summary || item.desc || '',
    contentHtml,
    jsonStr(item.specs || [], '[]'),
    item.model || '',
    status
  );
}

function upsertSolutionLang(db, id, lang, item, status) {
  const contentHtml = sanitizeContentHtml(item.contentHtml || item.detail || '');
  db.prepare(
    `INSERT INTO solution_i18n (solution_id, lang, name, summary, content_html, specs_json, pain_points_json, process_json, translation_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(solution_id, lang) DO UPDATE SET
       name=excluded.name, summary=excluded.summary, content_html=excluded.content_html,
       specs_json=excluded.specs_json, pain_points_json=excluded.pain_points_json,
       process_json=excluded.process_json, translation_status=excluded.translation_status,
       updated_at=datetime('now')`
  ).run(
    id,
    lang,
    item.name || '',
    item.summary || item.desc || '',
    contentHtml,
    jsonStr(item.specs || [], '[]'),
    item.painPoints ? jsonStr(item.painPoints) : null,
    item.process ? jsonStr(item.process) : null,
    status
  );
}

function upsertNewsLang(db, id, lang, item, status) {
  const contentHtml = sanitizeContentHtml(item.contentHtml || item.content || '');
  db.prepare(
    `INSERT INTO news_i18n (news_id, lang, category, title, content_html, date_display, translation_status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(news_id, lang) DO UPDATE SET
       category=excluded.category, title=excluded.title, content_html=excluded.content_html,
       date_display=excluded.date_display, translation_status=excluded.translation_status,
       updated_at=datetime('now')`
  ).run(
    id,
    lang,
    item.category || '',
    item.title || '',
    contentHtml,
    item.date || '',
    status
  );
}

function writeProductRow(db, item) {
  const id = String(item.id);
  const showInList =
    item.showInList === false || item.show_in_list === 0 || item.show_in_list === false ? 0 : 1;
  db.prepare(
    `INSERT INTO products (id, slug, category_key, model, image, sort_order, show_in_list, filter_key, filter_key_en, published, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       slug=excluded.slug, category_key=excluded.category_key, model=excluded.model, image=excluded.image,
       sort_order=excluded.sort_order, show_in_list=excluded.show_in_list,
       filter_key=excluded.filter_key, filter_key_en=excluded.filter_key_en,
       published=excluded.published, updated_at=datetime('now')`
  ).run(
    id,
    item.slug || null,
    item.category || '',
    item.model || '',
    item.image || '',
    Number(item.sortOrder != null ? item.sortOrder : item.sort_order) || Number(id) || 0,
    showInList,
    item.filterKey || item.filter_key || '',
    item.filterKeyEn || item.filter_key_en || '',
    publishedInt(item.published)
  );
  upsertProductLang(db, id, 'zh', item, 'source');
}

function writeSolutionRow(db, item) {
  const id = String(item.id);
  const slug = item.slug || SOLUTION_SLUG_BY_ID[id] || id;
  const homeSlot =
    item.homeSlot === 'hero' || item.homeSlot === 'category'
      ? item.homeSlot
      : item.home_slot === 'hero' || item.home_slot === 'category'
        ? item.home_slot
        : '';
  db.prepare(
    `INSERT INTO solutions (id, slug, category_key, image, sort_order, home_slot, filter_key, filter_key_en, published, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       slug=excluded.slug, category_key=excluded.category_key, image=excluded.image,
       sort_order=excluded.sort_order, home_slot=excluded.home_slot,
       filter_key=excluded.filter_key, filter_key_en=excluded.filter_key_en,
       published=excluded.published, updated_at=datetime('now')`
  ).run(
    id,
    slug,
    item.category || '',
    item.image || '',
    Number(item.sortOrder != null ? item.sortOrder : item.sort_order) || Number(id) || 0,
    homeSlot,
    item.filterKey || item.filter_key || '',
    item.filterKeyEn || item.filter_key_en || '',
    publishedInt(item.published)
  );
  upsertSolutionLang(db, id, 'zh', item, 'source');
}

function writeNewsRow(db, item) {
  const id = String(item.id);
  const homeFeatured = item.homeFeatured === true || item.home_featured === 1 || item.home_featured === true ? 1 : 0;
  db.prepare(
    `INSERT INTO news (id, slug, cover, category_key, published_at, sort_order, home_featured, published, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       slug=excluded.slug, cover=excluded.cover, category_key=excluded.category_key,
       published_at=excluded.published_at,
       sort_order=excluded.sort_order, home_featured=excluded.home_featured,
       published=excluded.published, updated_at=datetime('now')`
  ).run(
    id,
    item.slug || null,
    item.cover || '',
    item.categoryKey || item.category_key || '',
    item.date || '',
    Number(item.sortOrder != null ? item.sortOrder : item.sort_order) || Number(id) || 0,
    homeFeatured,
    publishedInt(item.published)
  );
  upsertNewsLang(db, id, 'zh', item, 'source');
}

export function nextCatalogId(kind) {
  const db = getDb();
  const table = kind === 'products' ? 'products' : kind === 'solutions' ? 'solutions' : 'news';
  const row = db.prepare(`SELECT MAX(CAST(id AS INTEGER)) AS m FROM ${table}`).get();
  return String((row?.m || 0) + 1);
}

export function createCatalogItemRaw(kind, item) {
  const db = getDb();
  const id = item.id ? String(item.id) : nextCatalogId(kind);
  const existing = getCatalogItemRaw(kind, id);
  if (existing) throw new Error('already_exists');
  const published =
    Object.prototype.hasOwnProperty.call(item, 'published') ? !!item.published : false;
  const replaceId = item.replaceId || item.replace_id || null;
  const row = { ...item, id, published };
  delete row.replaceId;
  delete row.replace_id;
  if (kind === 'solutions') assertSolutionHomeSlot(row, { replaceId });
  if (kind === 'news') assertNewsHomeFeatured(row, { replaceId });
  if (kind === 'products') writeProductRow(db, row);
  else if (kind === 'solutions') writeSolutionRow(db, row);
  else if (kind === 'news') writeNewsRow(db, row);
  else throw new Error('invalid_catalog_kind');
  ensureDerivedCatalogRow(kind, id, row);
  exportCatalogLang(kind, 'zh', { onlyIds: [id] });
  clearPublicCache();
  return getCatalogItemRaw(kind, id);
}

export function updateCatalogItemRaw(kind, id, patch, beforeItem) {
  const key = String(id);
  const cur = beforeItem || getCatalogItemRaw(kind, key);
  if (!cur) throw new Error('not_found');
  const replaceId = patch.replaceId || patch.replace_id || null;
  const row = { ...cur, ...patch, id: key };
  delete row.replaceId;
  delete row.replace_id;
  const db = getDb();
  // Validate destination capacity FIRST (may throw 409 home_slot_full) before
  // any vacate promotion runs, and keep the whole mutation atomic so a failed
  // save never leaves slots over-occupied.
  db.exec('BEGIN');
  try {
    if (kind === 'solutions') assertSolutionHomeSlot(row, { replaceId });
    if (kind === 'news') assertNewsHomeFeatured(row, { replaceId });
    if (kind === 'solutions' || kind === 'news') {
      guardRequiredSlotVacate(kind, cur, row, { replaceId });
    }
    if (kind === 'products') writeProductRow(db, row);
    else if (kind === 'solutions') writeSolutionRow(db, row);
    else if (kind === 'news') writeNewsRow(db, row);
    else throw new Error('invalid_catalog_kind');
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) { /* ignore rollback failure */ }
    throw err;
  }
  ensureDerivedCatalogRow(kind, key, row);
  exportCatalogLang(kind, 'zh', { onlyIds: [key] });
  clearPublicCache();
  return getCatalogItemRaw(kind, key);
}

export function deleteCatalogItemRaw(kind, id, opts = {}) {
  const db = getDb();
  const key = String(id);
  const cur = getCatalogItemRaw(kind, key);
  if (!cur) throw new Error('not_found');
  db.exec('BEGIN');
  try {
    if (kind === 'solutions' || kind === 'news') {
      const vacated = {
        ...cur,
        published: false,
        homeSlot: '',
        homeFeatured: false,
      };
      guardRequiredSlotVacate(kind, cur, vacated, opts);
    }
    if (kind === 'products') db.prepare('DELETE FROM products WHERE id = ?').run(key);
    else if (kind === 'solutions') db.prepare('DELETE FROM solutions WHERE id = ?').run(key);
    else if (kind === 'news') db.prepare('DELETE FROM news WHERE id = ?').run(key);
    else throw new Error('invalid_catalog_kind');
    db.exec('COMMIT');
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch (_) { /* ignore rollback failure */ }
    throw err;
  }
  for (const lang of LANGS) exportCatalogLang(kind, lang);
  for (const lang of LANGS) {
    const itemPath = path.join(DATA_DIR, kind, 'items', lang, `${key}.json`);
    try {
      fs.rmSync(itemPath, { force: true });
    } catch (_) { /* best-effort cleanup of the removed item's detail file */ }
  }
  // Drop the translation snapshot for this item so a re-created id won't
  // wrongly reuse a stale translation.
  removeItemSnapshot(kind, key);
  clearPublicCache();
  return true;
}

/** Ensure en/ru i18n rows exist (zh text placeholder). */
export function ensureDerivedCatalogRow(kind, id, zhRow) {
  const db = getDb();
  const key = String(id);
  const clone = { ...zhRow, id: key };
  for (const lang of ['en', 'ru']) {
    let created = false;
    if (kind === 'products') {
      const exists = db
        .prepare('SELECT 1 FROM product_i18n WHERE product_id = ? AND lang = ?')
        .get(key, lang);
      if (!exists) { upsertProductLang(db, key, lang, clone, 'missing'); created = true; }
    } else if (kind === 'solutions') {
      const exists = db
        .prepare('SELECT 1 FROM solution_i18n WHERE solution_id = ? AND lang = ?')
        .get(key, lang);
      if (!exists) { upsertSolutionLang(db, key, lang, clone, 'missing'); created = true; }
    } else if (kind === 'news') {
      const exists = db
        .prepare('SELECT 1 FROM news_i18n WHERE news_id = ? AND lang = ?')
        .get(key, lang);
      if (!exists) { upsertNewsLang(db, key, lang, clone, 'missing'); created = true; }
    }
    // Only write static files for a language whose row was actually created;
    // untouched en/ru content must not trigger a full re-export on zh saves.
    if (created) exportCatalogLang(kind, lang, { onlyIds: [key] });
  }
}

/** Mark only one item's en/ru rows stale so the scheduler translates just it. */
export function markCatalogItemStale(kind, id) {
  const table = kind === 'products' ? 'product_i18n' :
    kind === 'solutions' ? 'solution_i18n' :
    kind === 'news' ? 'news_i18n' : null;
  const col = kind === 'products' ? 'product_id' :
    kind === 'solutions' ? 'solution_id' :
    kind === 'news' ? 'news_id' : null;
  if (!table || !col) return;
  const db = getDb();
  db.prepare(
    `UPDATE ${table} SET translation_status='stale', updated_at=datetime('now')
     WHERE ${col} = ? AND lang IN ('en','ru')`
  ).run(String(id));
}

export function removeDerivedCatalogRow(kind, id) {
  // CASCADE from parent delete handles this; kept for API compat
  void kind;
  void id;
}

/** Replace entire catalog for a lang (translation pipeline). */
export function writeCatalogJsonAny(kind, lang, data) {
  if (!CATALOG_JS_GLOBALS[kind]) throw new Error('invalid_catalog_kind');
  if (!LANGS.includes(lang)) throw new Error('invalid_lang');
  const db = getDb();
  const status = lang === 'zh' ? 'source' : 'current';

  for (const id of Object.keys(data)) {
    const item = { ...data[id], id };
    if (kind === 'products') {
      if (lang === 'zh') writeProductRow(db, item);
      else {
        // ensure parent exists
        const p = db.prepare('SELECT id FROM products WHERE id = ?').get(String(id));
        if (!p) writeProductRow(db, { ...item, published: item.published !== false });
        upsertProductLang(db, String(id), lang, item, status);
      }
    } else if (kind === 'solutions') {
      if (lang === 'zh') writeSolutionRow(db, item);
      else {
        const p = db.prepare('SELECT id FROM solutions WHERE id = ?').get(String(id));
        if (!p) writeSolutionRow(db, { ...item, published: item.published !== false });
        upsertSolutionLang(db, String(id), lang, item, status);
      }
    } else if (kind === 'news') {
      if (lang === 'zh') writeNewsRow(db, item);
      else {
        const p = db.prepare('SELECT id FROM news WHERE id = ?').get(String(id));
        if (!p) writeNewsRow(db, { ...item, published: item.published !== false });
        upsertNewsLang(db, String(id), lang, item, status);
      }
    }
  }
  if (lang === 'zh' && (kind === 'solutions' || kind === 'news')) {
    reconcileHomeSlots();
  }
  exportCatalogLang(kind, lang);
  clearPublicCache();
  return true;
}

export function writeCatalogJson(kind, lang, data) {
  if (lang !== 'zh') throw new Error('admin_writes_zh_only');
  return writeCatalogJsonAny(kind, lang, data);
}

export function writeSiteSettings(lang, data) {
  if (lang !== 'zh') throw new Error('admin_writes_zh_only');
  return writeSiteSettingsAny(lang, data);
}

export function writeSiteSettingsAny(lang, data) {
  if (!LANGS.includes(lang)) throw new Error('invalid_lang');
  const db = getDb();
  db.prepare(
    `INSERT INTO site_settings (lang, settings_json, translation_status, updated_at)
     VALUES (?, ?, ?, datetime('now'))
     ON CONFLICT(lang) DO UPDATE SET
       settings_json=excluded.settings_json,
       translation_status=excluded.translation_status,
       updated_at=datetime('now')`
  ).run(lang, JSON.stringify(data), lang === 'zh' ? 'source' : 'current');
  exportSiteLang(lang);
  clearPublicCache();
  return true;
}

/** 深度净化：sections 内所有含 < 的字符串一律过白名单清洗（页面富文本与详情同等对待） */
function sanitizeRichTextDeep(value) {
  if (typeof value === 'string') {
    return value.includes('<') ? sanitizeContentHtml(value) : value;
  }
  if (Array.isArray(value)) return value.map(sanitizeRichTextDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitizeRichTextDeep(v);
    return out;
  }
  return value;
}

export function writePageJsonAny(pageKey, lang, data) {
  if (!LANGS.includes(lang)) throw new Error('invalid_lang');
  const db = getDb();
  const payload = { ...data, pageKey, lang };
  const seo = payload.seo || null;
  const sections = sanitizeRichTextDeep({ ...payload });
  delete sections.seo;
  delete sections.pageKey;
  delete sections.lang;
  db.prepare(
    `INSERT INTO pages (page_key, lang, seo_json, sections_json, translation_status, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(page_key, lang) DO UPDATE SET
       seo_json=excluded.seo_json, sections_json=excluded.sections_json,
       translation_status=excluded.translation_status, updated_at=datetime('now')`
  ).run(
    pageKey,
    lang,
    seo ? JSON.stringify(seo) : null,
    JSON.stringify(sections),
    lang === 'zh' ? 'source' : 'current'
  );
  exportPageLang(pageKey, lang);
  clearPublicCache();
  return true;
}

export function regenerateCatalogJs(kind, lang = 'zh') {
  return exportCatalogLang(kind, lang);
}

export function regeneratePageJs(pageKey, lang = 'zh') {
  return exportPageLang(pageKey, lang);
}

function exportCatalogLang(kind, lang, opts = {}) {
  if (!syncJsonEnabled()) return null;
  const globalName = CATALOG_JS_GLOBALS[kind];
  if (!globalName) return null;
  const data = readCatalogJson(kind, lang);
  const dir = path.join(DATA_DIR, kind);
  fs.mkdirSync(dir, { recursive: true });
  const sorted = {};
  Object.keys(data)
    .sort((a, b) => Number(a) - Number(b))
    .forEach((id) => {
      sorted[id] = data[id];
    });
  const raw = JSON.stringify(sorted, null, 2) + '\n';
  writeFileSyncAtomic(path.join(dir, `${lang}.json`), raw);
  const itemsDir = path.join(dir, 'items', lang);
  fs.mkdirSync(itemsDir, { recursive: true });
  const onlyIds = opts && opts.onlyIds
    ? new Set((Array.isArray(opts.onlyIds) ? opts.onlyIds : [opts.onlyIds]).map(String))
    : null;
  for (const [id, item] of Object.entries(sorted)) {
    if (onlyIds && !onlyIds.has(id)) continue;
    writeFileSyncAtomic(path.join(itemsDir, `${id}.json`), JSON.stringify(item, null, 2) + '\n');
  }
  // 清理已下架条目的幽灵快照（catalog 中不存在的 item 文件）
  if (!onlyIds) {
    for (const f of fs.readdirSync(itemsDir)) {
      if (!f.endsWith('.json')) continue;
      const snapId = f.replace(/\.json$/, '');
      if (!sorted[snapId]) {
        fs.unlinkSync(path.join(itemsDir, f));
        console.log(`[catalog] removed stale item snapshot: ${kind}/${lang}/${snapId}`);
      }
    }
  }
  const slim = slimCatalogMap(kind, sorted);
  writeFileSyncAtomic(
    path.join(dir, `${lang}.js`),
    `/* auto-generated from sqlite (list-slim) — do not edit */\nwindow.${globalName}_${lang.toUpperCase()}=${toJsLiteral(slim)};\n`
  );
  return path.join(dir, `${lang}.js`);
}

function exportSiteLang(lang) {
  if (!syncJsonEnabled()) return null;
  const data = loadSiteSettings(lang);
  const filePath = path.join(DATA_DIR, 'i18n', `${lang}.json`);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSyncAtomic(filePath, JSON.stringify(data, null, 2) + '\n');
  writeFileSyncAtomic(
    path.join(DATA_DIR, 'i18n', `${lang}.js`),
    `/* auto-generated from sqlite — do not edit */\nwindow.__TXAM_SITE_${lang.toUpperCase()}=${toJsLiteral(data)};\n`
  );
  return filePath;
}

function exportPageLang(pageKey, lang) {
  if (!syncJsonEnabled()) return null;
  const page = readPageJson(pageKey, lang);
  if (!page) return null;
  const dir = path.join(DATA_DIR, 'pages', pageKey);
  fs.mkdirSync(dir, { recursive: true });
  writeFileSyncAtomic(path.join(dir, `${lang}.json`), JSON.stringify(page, null, 2) + '\n');
  const globalName = `__TXAM_PAGE_${pageKey.toUpperCase()}`;
  writeFileSyncAtomic(
    path.join(dir, `${lang}.js`),
    `/* auto-generated from sqlite — do not edit */\nwindow.${globalName}_${lang.toUpperCase()}=${toJsLiteral(page)};\n`
  );
  return path.join(dir, `${lang}.js`);
}

/** Validate legacy JSON alignment (import helper). */
export function validateDataFiles() {
  const warnings = [];
  for (const kind of ['products', 'solutions', 'news']) {
    for (const lang of LANGS) {
      const filePath = path.join(DATA_DIR, kind, `${lang}.json`);
      if (!fs.existsSync(filePath)) {
        warnings.push(`missing ${filePath}`);
        continue;
      }
      const count = Object.keys(JSON.parse(fs.readFileSync(filePath, 'utf8'))).length;
      console.log(`${kind} ${lang}: ${count} items (json)`);
    }
  }
  return warnings;
}

export {
  exportCatalogLang,
  exportSiteLang,
  exportPageLang,
  SOLUTION_SLUG_BY_ID as solutionSlugById,
};
