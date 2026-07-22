-- TXAM SQLite schema (dev). PostgreSQL variant: schema/tables.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  slug TEXT,
  category_key TEXT,
  model TEXT,
  image TEXT,
  sort_order INTEGER DEFAULT 0,
  show_in_list INTEGER DEFAULT 1,
  filter_key TEXT DEFAULT '',
  filter_key_en TEXT DEFAULT '',
  published INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_i18n (
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('zh', 'en', 'ru')),
  name TEXT NOT NULL,
  summary TEXT,
  content_html TEXT,
  specs_json TEXT,
  translation_status TEXT DEFAULT 'current'
    CHECK (translation_status IN ('source', 'current', 'stale', 'missing')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (product_id, lang)
);

CREATE TABLE IF NOT EXISTS solutions (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  category_key TEXT,
  image TEXT,
  sort_order INTEGER DEFAULT 0,
  home_slot TEXT DEFAULT '',
  published INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS solution_i18n (
  solution_id TEXT NOT NULL REFERENCES solutions(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('zh', 'en', 'ru')),
  name TEXT NOT NULL,
  summary TEXT,
  content_html TEXT,
  specs_json TEXT,
  pain_points_json TEXT,
  process_json TEXT,
  translation_status TEXT DEFAULT 'current'
    CHECK (translation_status IN ('source', 'current', 'stale', 'missing')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (solution_id, lang)
);

CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  slug TEXT,
  cover TEXT,
  published_at TEXT,
  sort_order INTEGER DEFAULT 0,
  home_featured INTEGER DEFAULT 0,
  published INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS news_i18n (
  news_id TEXT NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  lang TEXT NOT NULL CHECK (lang IN ('zh', 'en', 'ru')),
  category TEXT,
  title TEXT NOT NULL,
  content_html TEXT,
  date_display TEXT,
  translation_status TEXT DEFAULT 'current'
    CHECK (translation_status IN ('source', 'current', 'stale', 'missing')),
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (news_id, lang)
);

CREATE TABLE IF NOT EXISTS pages (
  page_key TEXT NOT NULL,
  lang TEXT NOT NULL CHECK (lang IN ('zh', 'en', 'ru')),
  seo_json TEXT,
  sections_json TEXT,
  translation_status TEXT DEFAULT 'current',
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (page_key, lang)
);

CREATE TABLE IF NOT EXISTS site_settings (
  lang TEXT NOT NULL CHECK (lang IN ('zh', 'en', 'ru')),
  settings_json TEXT NOT NULL,
  translation_status TEXT DEFAULT 'current',
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (lang)
);

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  alt TEXT,
  mime TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS translation_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  source_lang TEXT DEFAULT 'zh',
  target_langs TEXT NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'done', 'failed')),
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

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

CREATE INDEX IF NOT EXISTS idx_products_published ON products(published);
CREATE INDEX IF NOT EXISTS idx_solutions_slug ON solutions(slug);
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news(published_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON admin_audit_log(action);

CREATE TABLE IF NOT EXISTS page_view_daily (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (day, path)
);

CREATE INDEX IF NOT EXISTS idx_page_view_day ON page_view_daily(day);
