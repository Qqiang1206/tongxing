-- TXAM PostgreSQL schema (production reference)
-- Logical model matches schema/sqlite-init.sql

CREATE TABLE products (
  id VARCHAR(32) PRIMARY KEY,
  slug VARCHAR(128),
  category_key VARCHAR(128),
  model VARCHAR(128),
  image VARCHAR(512),
  sort_order INT DEFAULT 0,
  show_in_list BOOLEAN DEFAULT TRUE,
  filter_key VARCHAR(64) DEFAULT '',
  filter_key_en VARCHAR(64) DEFAULT '',
  published BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE product_i18n (
  product_id VARCHAR(32) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  lang CHAR(2) NOT NULL CHECK (lang IN ('zh', 'en', 'ru')),
  name VARCHAR(256) NOT NULL,
  summary TEXT,
  content_html TEXT,
  specs_json JSONB,
  translation_status VARCHAR(16) DEFAULT 'current',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (product_id, lang)
);

CREATE TABLE solutions (
  id VARCHAR(32) PRIMARY KEY,
  slug VARCHAR(128) UNIQUE,
  category_key VARCHAR(128),
  image VARCHAR(512),
  sort_order INT DEFAULT 0,
  home_slot VARCHAR(32) DEFAULT '',
  published BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE solution_i18n (
  solution_id VARCHAR(32) NOT NULL REFERENCES solutions(id) ON DELETE CASCADE,
  lang CHAR(2) NOT NULL CHECK (lang IN ('zh', 'en', 'ru')),
  name VARCHAR(256) NOT NULL,
  summary TEXT,
  content_html TEXT,
  specs_json JSONB,
  pain_points_json JSONB,
  process_json JSONB,
  translation_status VARCHAR(16) DEFAULT 'current',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (solution_id, lang)
);

CREATE TABLE news (
  id VARCHAR(32) PRIMARY KEY,
  slug VARCHAR(128),
  cover VARCHAR(512),
  published_at DATE,
  sort_order INT DEFAULT 0,
  home_featured BOOLEAN DEFAULT FALSE,
  published BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE news_i18n (
  news_id VARCHAR(32) NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  lang CHAR(2) NOT NULL CHECK (lang IN ('zh', 'en', 'ru')),
  category VARCHAR(64),
  title VARCHAR(512) NOT NULL,
  content_html TEXT,
  date_display VARCHAR(32),
  translation_status VARCHAR(16) DEFAULT 'current',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (news_id, lang)
);

CREATE TABLE pages (
  page_key VARCHAR(64) NOT NULL,
  lang CHAR(2) NOT NULL CHECK (lang IN ('zh', 'en', 'ru')),
  seo_json JSONB,
  sections_json JSONB,
  translation_status VARCHAR(16) DEFAULT 'current',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (page_key, lang)
);

CREATE TABLE site_settings (
  lang CHAR(2) PRIMARY KEY CHECK (lang IN ('zh', 'en', 'ru')),
  settings_json JSONB NOT NULL,
  translation_status VARCHAR(16) DEFAULT 'current',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE media (
  id UUID PRIMARY KEY,
  path VARCHAR(512) NOT NULL,
  alt VARCHAR(256),
  mime VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE translation_jobs (
  id BIGSERIAL PRIMARY KEY,
  entity_type VARCHAR(32) NOT NULL,
  entity_id VARCHAR(32) NOT NULL,
  source_lang CHAR(2) DEFAULT 'zh',
  target_langs VARCHAR(16) NOT NULL,
  status VARCHAR(16) DEFAULT 'pending',
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
