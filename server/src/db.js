/**
 * SQLite via Node built-in node:sqlite (no native npm deps).
 * Default path: server/data/txam.db (override with SQLITE_PATH / DB_PATH).
 */
import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'url';
import { ROOT } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(ROOT, 'schema', 'sqlite-init.sql');

let dbInstance = null;

export function resolveSqlitePath() {
  const raw = process.env.SQLITE_PATH || process.env.DB_PATH || './data/txam.db';
  return path.isAbsolute(raw) ? raw : path.join(ROOT, raw);
}

export function getDb() {
  if (dbInstance) return dbInstance;

  const dbPath = resolveSqlitePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA busy_timeout = 5000;');

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  db.exec(schema);

  // Resource-level translation status (admin dashboard)
  db.exec(`
    CREATE TABLE IF NOT EXISTS resource_translation_status (
      resource TEXT NOT NULL,
      lang TEXT NOT NULL CHECK (lang IN ('en', 'ru')),
      status TEXT NOT NULL DEFAULT 'current'
        CHECK (status IN ('current', 'stale', 'missing')),
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (resource, lang)
    );
  `);

  // Richer translation job payload than minimal schema stub
  db.exec(`
    CREATE TABLE IF NOT EXISTS translation_job_store (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resource TEXT NOT NULL,
      source_lang TEXT DEFAULT 'zh',
      target_langs_json TEXT NOT NULL,
      status TEXT DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'done', 'failed')),
      note TEXT,
      error TEXT,
      result_json TEXT,
      attempts INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      started_at TEXT,
      completed_at TEXT
    );
  `);
  // Shared translation memory for copy that must remain identical across
  // resources (for example the same page hero / SEO title on every page).
  db.exec(`
    CREATE TABLE IF NOT EXISTS translation_memory (
      scope TEXT NOT NULL,
      source_norm TEXT NOT NULL,
      lang TEXT NOT NULL CHECK (lang IN ('en', 'ru')),
      translation TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (scope, source_norm, lang)
    );
  `);
  // Additive migration for pre-existing DBs lacking attempts column.
  {
    const cols = db.prepare('PRAGMA table_info(translation_job_store)').all().map((c) => c.name);
    if (!cols.includes('attempts')) {
      db.exec(`ALTER TABLE translation_job_store ADD COLUMN attempts INTEGER DEFAULT 0`);
    }
  }

  // Per-call API usage log for translation providers (OpenAI-compatible).
  // Each chunk call to translateProvider writes one row here.
  db.exec(`
    CREATE TABLE IF NOT EXISTS translation_api_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      called_at TEXT DEFAULT (datetime('now')),
      engine_name TEXT,
      provider TEXT,
      model TEXT,
      target_lang TEXT,
      input_chars INTEGER DEFAULT 0,
      output_chars INTEGER DEFAULT 0,
      prompt_tokens INTEGER DEFAULT 0,
      completion_tokens INTEGER DEFAULT 0,
      total_tokens INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      success INTEGER DEFAULT 1,
      http_status INTEGER,
      error TEXT,
      job_id INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_api_log_called_at ON translation_api_log(called_at DESC);
    CREATE INDEX IF NOT EXISTS idx_api_log_job ON translation_api_log(job_id);
    CREATE INDEX IF NOT EXISTS idx_api_log_engine ON translation_api_log(engine_name);
  `);

  migrateProductColumns(db);
  ensureCategoryTablesInline(db);
  migrateSolutionColumns(db);
  migrateNewsCategoryKey(db);
  migrateProductI18nModel(db);
  migrateHomeSlotColumns(db);
  ensureAuditTableInline(db);
  migrateMediaColumnsInline(db);
  ensurePageViewsTableInline(db);
  ensureTranslationEngineTable(db);
  seedResourceStatus(db);
  dbInstance = db;
  return db;
}

function ensureCategoryTablesInline(db) {
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
  // Additive migration: name_ru for pre-existing DBs
  for (const table of ['product_categories', 'solution_categories']) {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
    if (!cols.includes('name_ru')) db.exec(`ALTER TABLE ${table} ADD COLUMN name_ru TEXT DEFAULT ''`);
  }
  // Backfill name_ru from seed data
  {
    const empty = db.prepare(`SELECT COUNT(*) AS c FROM product_categories WHERE name_ru IS NULL OR name_ru = ''`).get()?.c || 0;
    if (empty > 0) {
      const ruMap = {
        optical: 'Сборка оптики', dispensing: 'Дозирование', flip: 'Контроль переворота',
        screw: 'Винтовая сборка', transfer: 'Перемещение', packaging: 'Упаковка',
        robot: 'Робототехника', line: 'Линии под ключ', software: 'ПО и управление',
      };
      const upd = db.prepare(`UPDATE product_categories SET name_ru = ? WHERE key = ?`);
      for (const [k, v] of Object.entries(ruMap)) upd.run(v, k);
    }
    const emptyS = db.prepare(`SELECT COUNT(*) AS c FROM solution_categories WHERE name_ru IS NULL OR name_ru = ''`).get()?.c || 0;
    if (emptyS > 0) {
      const ruMap = {
        'tv-display': 'ТВ и коммерческие дисплеи', refrigerator: 'Бытовая техника',
        packaging: 'Логистика и упаковка', washer: '3C-электроника', capacitor: 'Накопители энергии',
        ac: 'Автомобильная отрасль', microwave: 'Микроволновые печи', coffee: 'Кофемашины',
        tablet: 'Планшеты', headlight: 'Автомобильные фары', robot: 'Робототехника',
      };
      const upd = db.prepare(`UPDATE solution_categories SET name_ru = ? WHERE key = ?`);
      for (const [k, v] of Object.entries(ruMap)) upd.run(v, k);
    }
  }
  const pc = db.prepare('SELECT COUNT(*) AS c FROM product_categories').get()?.c || 0;
  if (pc === 0) {
    const rows = [
      ['optical', '光学元件组装', 'Optical Assembly', 'optical', 10],
      ['dispensing', '点胶装配', 'Dispensing', 'dispensing', 20],
      ['flip', '翻转检测', 'Flip Detection', 'flip', 30],
      ['screw', '锁付组装', 'Screw Assembly', 'screw', 40],
      ['transfer', '搬运移载', 'Transfer', 'transfer', 50],
      ['packaging', '后段包装', 'Packaging', 'packaging', 60],
      ['robot', '机器人集成', 'Robot Integration', 'robot', 70],
      ['line', '整线交付', 'Production Lines', 'single', 80],
      ['software', '软件控制', 'Software & Control', 'single', 90],
    ];
    const ins = db.prepare(
      `INSERT INTO product_categories (key, name, name_en, filter_key_en, sort_order) VALUES (?,?,?,?,?)`
    );
    for (const r of rows) ins.run(...r);
  }
  const nc = db.prepare('SELECT COUNT(*) AS c FROM news_categories').get()?.c || 0;
  if (nc === 0) {
    const rows = [
      ['company', '公司新闻', 10],
      ['project', '项目故事', 20],
      ['industry', '行业洞察', 30],
    ];
    const ins = db.prepare(
      `INSERT INTO news_categories (key, name, sort_order) VALUES (?,?,?)`
    );
    for (const r of rows) ins.run(...r);
  }
  const sc = db.prepare('SELECT COUNT(*) AS c FROM solution_categories').get()?.c || 0;
  if (sc === 0) {
    const rows = [
      ['tv-display', 'TV / 商显', 'TV & Commercial Display', 'tv-display', 10],
      ['refrigerator', '冰箱', 'Refrigerator', 'refrigerator', 20],
      ['packaging', '包装', 'Packaging', 'packaging', 30],
      ['washer', '洗衣机', 'Washer', 'washer', 40],
      ['capacitor', '电容', 'Capacitor', 'capacitor', 50],
      ['ac', '空调', 'Air Conditioning', 'ac', 60],
      ['microwave', '微波炉', 'Microwave', 'microwave', 70],
      ['coffee', '咖啡机', 'Coffee Machine', 'coffee', 80],
      ['tablet', '平板', 'Tablet', 'tablet', 90],
      ['headlight', '车灯', 'Headlight', 'headlight', 100],
      ['robot', '机器人', 'Robot', 'robot', 110],
    ];
    const ins = db.prepare(
      `INSERT INTO solution_categories (key, name, name_en, filter_key_en, sort_order) VALUES (?,?,?,?,?)`
    );
    for (const r of rows) ins.run(...r);
  }
}

function ensurePageViewsTableInline(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS page_view_daily (
      day TEXT NOT NULL,
      path TEXT NOT NULL,
      hits INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (day, path)
    );
    CREATE INDEX IF NOT EXISTS idx_page_view_day ON page_view_daily(day);
  `);
}

function migrateMediaColumnsInline(db) {
  const cols = db.prepare('PRAGMA table_info(media)').all().map((c) => c.name);
  const adds = [
    ['thumb_path', 'TEXT'],
    ['original_path', 'TEXT'],
    ['width', 'INTEGER'],
    ['height', 'INTEGER'],
    ['original_bytes', 'INTEGER'],
    ['display_bytes', 'INTEGER'],
  ];
  for (const [name, type] of adds) {
    if (!cols.includes(name)) {
      db.exec(`ALTER TABLE media ADD COLUMN ${name} ${type}`);
    }
  }
}

function ensureAuditTableInline(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now')),
      actor TEXT DEFAULT 'admin',
      action TEXT NOT NULL,
      resource TEXT,
      resource_id TEXT,
      summary TEXT,
      detail_json TEXT,
      ip TEXT,
      ok INTEGER DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action);
  `);
}

/** Additive migrations: homepage featured slots on solutions / news. */
function migrateHomeSlotColumns(db) {
  const solCols = db.prepare('PRAGMA table_info(solutions)').all().map((c) => c.name);
  if (!solCols.includes('home_slot')) {
    db.exec(`ALTER TABLE solutions ADD COLUMN home_slot TEXT DEFAULT ''`);
  }
  const newsCols = db.prepare('PRAGMA table_info(news)').all().map((c) => c.name);
  if (!newsCols.includes('home_featured')) {
    db.exec(`ALTER TABLE news ADD COLUMN home_featured INTEGER DEFAULT 0`);
  }
  try {
    // lazy import avoided — seed inline to keep db.js free of cycle issues
    const { seedHomeSlotsIfEmpty } = requireHomeSlots();
    seedHomeSlotsIfEmpty(db);
    // clear unpublished leftovers / trim over-capacity (best-effort)
    db.prepare(
      `UPDATE solutions SET home_slot = '', updated_at = datetime('now')
       WHERE published = 0 AND home_slot IS NOT NULL AND home_slot != ''`
    ).run();
    db.prepare(
      `UPDATE news SET home_featured = 0, updated_at = datetime('now')
       WHERE published = 0 AND home_featured = 1`
    ).run();
  } catch {
    /* seed is best-effort */
  }
}

function requireHomeSlots() {
  // Dynamic import sync via createRequire pattern isn't available in all ESM;
  // call seed after getDb is fully set by importing at bottom through side effect.
  return { seedHomeSlotsIfEmpty: (database) => {
    const solCount =
      database.prepare(
        `SELECT COUNT(*) AS c FROM solutions WHERE home_slot IS NOT NULL AND home_slot != ''`
      ).get()?.c || 0;
    if (solCount === 0) {
      const has = (id) => database.prepare('SELECT id FROM solutions WHERE id = ?').get(String(id));
      if (has('31')) database.prepare(`UPDATE solutions SET home_slot = 'hero' WHERE id = '31'`).run();
      if (has('33')) database.prepare(`UPDATE solutions SET home_slot = 'category' WHERE id = '33'`).run();
      if (has('32')) database.prepare(`UPDATE solutions SET home_slot = 'category' WHERE id = '32'`).run();
    }
    const newsCount =
      database.prepare(`SELECT COUNT(*) AS c FROM news WHERE home_featured = 1`).get()?.c || 0;
    if (newsCount === 0) {
      const has = (id) => database.prepare('SELECT id FROM news WHERE id = ?').get(String(id));
      if (has('1')) database.prepare(`UPDATE news SET home_featured = 1 WHERE id = '1'`).run();
      if (has('3')) database.prepare(`UPDATE news SET home_featured = 1 WHERE id = '3'`).run();
    }
  } };
}

/** Additive migrations for existing DBs created before new columns existed. */
function migrateProductColumns(db) {
  const cols = db.prepare('PRAGMA table_info(products)').all().map((c) => c.name);
  const add = (name, ddl) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE products ADD COLUMN ${ddl}`);
  };
  add('show_in_list', 'show_in_list INTEGER DEFAULT 1');
  add('filter_key', "filter_key TEXT DEFAULT ''");
  add('filter_key_en', "filter_key_en TEXT DEFAULT ''");

  // One-time seed when filter keys are all empty (fresh migration)
  const stats = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN filter_key IS NULL OR filter_key = '' THEN 1 ELSE 0 END) AS empty
       FROM products`
    )
    .get();
  if (stats && stats.total > 0 && stats.empty === stats.total) {
    const hidden = new Set(['3', '16', '17', '25', '26']);
    const order = [
      '1', '2', '4', '11', '9', '8', '12', '18', '19', '20', '21', '22', '23', '24',
      '5', '6', '7', '10', '15', '13', '14', '27', '28', '29', '30',
    ];
    const fz = {
      '1': 'optical', '2': 'optical', '3': 'optical', '4': 'dispensing', '5': 'dispensing',
      '6': 'optical', '7': 'optical', '8': 'screw', '9': 'flip', '10': 'optical',
      '11': 'robot', '12': 'robot', '13': 'robot', '14': 'packaging', '15': 'flip',
      '16': 'packaging', '17': 'transfer', '18': 'transfer', '19': 'transfer', '20': 'transfer',
      '21': 'screw', '22': 'packaging', '23': 'packaging', '24': 'robot', '25': 'robot',
      '26': 'transfer', '27': 'packaging', '28': 'packaging', '29': 'packaging', '30': 'robot',
    };
    // filter_key_en for products must equal filter_key — both are the same
    // language-neutral category key (optical/dispensing/...). The legacy `fe`
    // map wrote 'single'/'logistics' (category-level "no tab" markers) onto
    // individual products, which broke en/ru product filtering. 'single' is a
    // property of the *category* (line/software), never of a product.
    const upd = db.prepare(
      `UPDATE products SET show_in_list = ?, sort_order = ?, filter_key = ?, filter_key_en = ? WHERE id = ?`
    );
    for (const { id } of db.prepare('SELECT id FROM products').all()) {
      const sid = String(id);
      const oi = order.indexOf(sid);
      const fk = fz[sid] || '';
      upd.run(
        hidden.has(sid) ? 0 : 1,
        oi >= 0 ? oi + 1 : Number(sid) || 999,
        fk,
        fk,
        sid
      );
    }
  }

  // Legacy imports duplicated solution records 31–39 into the product table.
  // Keep them recoverable in the database, but never expose them in Product Center.
  db.prepare(
    `UPDATE products SET show_in_list = 0, updated_at = datetime('now')
     WHERE id IN ('31','32','33','34','35','36','37','38','39')
       AND show_in_list != 0`
  ).run();
}

function migrateSolutionColumns(db) {
  const cols = db.prepare('PRAGMA table_info(solutions)').all().map((c) => c.name);
  const add = (name, ddl) => {
    if (!cols.includes(name)) db.exec(`ALTER TABLE solutions ADD COLUMN ${ddl}`);
  };
  add('filter_key', "filter_key TEXT DEFAULT ''");
  add('filter_key_en', "filter_key_en TEXT DEFAULT ''");

  const stats = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN filter_key IS NULL OR filter_key = '' THEN 1 ELSE 0 END) AS empty
       FROM solutions`
    )
    .get();
  if (!stats || !stats.total || stats.empty === 0) return;

  const cats = db.prepare('SELECT key, name FROM solution_categories').all();
  const catByKey = Object.fromEntries(cats.map((c) => [c.key, c.name]));
  const upd = db.prepare(
    `UPDATE solutions SET filter_key = ?, filter_key_en = ?, category_key = ? WHERE id = ?`
  );
  for (const row of db.prepare('SELECT id, slug, category_key, filter_key FROM solutions').all()) {
    if (row.filter_key) continue;
    const slug = String(row.slug || '').trim();
    if (slug && catByKey[slug]) {
      upd.run(slug, slug, catByKey[slug], row.id);
      continue;
    }
    const fallback = cats[0];
    if (fallback) {
      upd.run(fallback.key, fallback.key, fallback.name, row.id);
    }
  }
}

function migrateNewsCategoryKey(db) {
  const cols = db.prepare('PRAGMA table_info(news)').all().map((c) => c.name);
  if (!cols.includes('category_key')) {
    db.exec(`ALTER TABLE news ADD COLUMN category_key TEXT DEFAULT ''`);
  }

  // Backfill: set category_key from zh category name → news_categories.key
  const empty = db.prepare(
    `SELECT COUNT(*) AS c FROM news WHERE category_key IS NULL OR category_key = ''`
  ).get()?.c || 0;
  if (empty === 0) return;

  const cats = db.prepare('SELECT key, name FROM news_categories').all();
  const nameToKey = Object.fromEntries(cats.map((c) => [c.name, c.key]));
  const zhCatMap = {};
  try {
    const rows = db.prepare(
      `SELECT news_id, category FROM news_i18n WHERE lang = 'zh'`
    ).all();
    for (const r of rows) zhCatMap[String(r.news_id)] = r.category || '';
  } catch { /* table may not exist yet */ }

  const upd = db.prepare(`UPDATE news SET category_key = ? WHERE id = ?`);
  for (const row of db.prepare('SELECT id FROM news').all()) {
    const zhCat = zhCatMap[String(row.id)] || '';
    const key = nameToKey[zhCat] || '';
    upd.run(key, row.id);
  }
}

/** Additive migration: add model column to product_i18n and backfill from main table. */
function migrateProductI18nModel(db) {
  const cols = db.prepare('PRAGMA table_info(product_i18n)').all().map((c) => c.name);
  if (!cols.includes('model')) {
    db.exec(`ALTER TABLE product_i18n ADD COLUMN model TEXT DEFAULT ''`);
  }
  // Backfill if i18n model is empty but main table has values
  const empty = db.prepare(
    `SELECT COUNT(*) AS c FROM product_i18n i JOIN products p ON p.id = i.product_id
     WHERE (i.model IS NULL OR i.model = '') AND p.model IS NOT NULL AND p.model != ''`
  ).get()?.c || 0;
  if (empty === 0) return;
  const products = db.prepare("SELECT id, model FROM products WHERE model IS NOT NULL AND model != ''").all();
  for (const p of products) {
    const en = p.model.replace(/系列/g, 'Series').trim();
    const ru = p.model.replace(/系列/g, 'Серия').trim();
    db.prepare(`UPDATE product_i18n SET model = ? WHERE product_id = ? AND lang = 'zh'`).run(p.model, p.id);
    db.prepare(`UPDATE product_i18n SET model = ? WHERE product_id = ? AND lang = 'en'`).run(en, p.id);
    db.prepare(`UPDATE product_i18n SET model = ? WHERE product_id = ? AND lang = 'ru'`).run(ru, p.id);
  }
}

function seedResourceStatus(db) {
  const defaults = [
    'products',
    'news',
    'solutions',
    'site',
    'pages:contact',
    'pages:home',
    'pages:about',
    'pages:products',
    'pages:news',
    'pages:solutions',
  ];
  const insert = db.prepare(`
    INSERT OR IGNORE INTO resource_translation_status (resource, lang, status)
    VALUES (?, ?, 'current')
  `);
  for (const resource of defaults) {
    insert.run(resource, 'en');
    insert.run(resource, 'ru');
  }
}

/**
 * Translation engine config table (managed via admin UI).
 * Seeds from env vars on first run so existing .env config is preserved.
 */
function ensureTranslationEngineTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS translation_engine_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      base_url TEXT NOT NULL,
      model TEXT NOT NULL,
      api_key TEXT NOT NULL DEFAULT '',
      is_active INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  const count = db.prepare('SELECT COUNT(*) AS c FROM translation_engine_config').get()?.c || 0;
  if (count > 0) return;

  const envProvider = (process.env.TRANSLATION_PROVIDER || '').toLowerCase();
  const envKey = process.env.TRANSLATION_API_KEY || process.env.DEEPSEEK_API_KEY || '';
  if (!envProvider || envProvider === 'echo' || !envKey) return;

  const PRESETS = {
    deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', label: 'DeepSeek' },
    openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', label: 'OpenAI' },
    qianwen: {
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-plus',
      label: '通义千问',
    },
  };
  const preset = PRESETS[envProvider];
  const baseUrl = (process.env.TRANSLATION_BASE_URL || (preset && preset.baseUrl) || '').replace(/\/$/, '');
  const model = process.env.TRANSLATION_MODEL || (preset && preset.model) || '';
  const name = preset ? preset.label : envProvider;

  db.prepare(
    `INSERT INTO translation_engine_config (name, provider, base_url, model, api_key, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, 1, 10)`
  ).run(name, envProvider, baseUrl, model, envKey);
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function dbPathForHealth() {
  return resolveSqlitePath();
}
