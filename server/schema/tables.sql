-- TXAM schema draft (PostgreSQL / MySQL compatible ideas)

CREATE TABLE products (
  id VARCHAR(32) PRIMARY KEY,
  slug VARCHAR(128),
  category_key VARCHAR(64),
  model VARCHAR(128),
  image VARCHAR(512),
  published BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_translations (
  product_id VARCHAR(32) REFERENCES products(id),
  lang CHAR(2) NOT NULL,
  name VARCHAR(256) NOT NULL,
  summary TEXT,
  content_html TEXT,
  specs_json TEXT,
  PRIMARY KEY (product_id, lang)
);

CREATE TABLE solutions (
  id VARCHAR(32) PRIMARY KEY,
  slug VARCHAR(128),
  category_key VARCHAR(64),
  image VARCHAR(512),
  published BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE solution_translations (
  solution_id VARCHAR(32) REFERENCES solutions(id),
  lang CHAR(2) NOT NULL,
  name VARCHAR(256) NOT NULL,
  summary TEXT,
  content_html TEXT,
  specs_json TEXT,
  pain_points_json TEXT,
  process_json TEXT,
  PRIMARY KEY (solution_id, lang)
);

CREATE TABLE news (
  id VARCHAR(32) PRIMARY KEY,
  cover VARCHAR(512),
  published BOOLEAN DEFAULT TRUE,
  published_at DATE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE news_translations (
  news_id VARCHAR(32) REFERENCES news(id),
  lang CHAR(2) NOT NULL,
  category VARCHAR(64),
  title VARCHAR(512) NOT NULL,
  content_html TEXT,
  PRIMARY KEY (news_id, lang)
);

CREATE TABLE contact_messages (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(128),
  email VARCHAR(256),
  phone VARCHAR(64),
  company VARCHAR(256),
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
