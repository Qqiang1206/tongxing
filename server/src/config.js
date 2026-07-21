import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.join(__dirname, '..');
export const REPO_ROOT = path.join(ROOT, '..');
export const DATA_DIR = path.join(REPO_ROOT, 'data');

export const config = {
  port: Number(process.env.PORT || 3000),
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || '*',
};

export const LANGS = ['zh', 'en', 'ru'];

export function parseLang(raw) {
  const lang = String(raw || 'zh').toLowerCase();
  return LANGS.includes(lang) ? lang : 'zh';
}

/** In-memory cache of data/{kind}/{lang}.json */
const cache = new Map();

export function loadJsonCatalog(kind, lang) {
  const key = `${kind}:${lang}`;
  if (cache.has(key)) return cache.get(key);

  const filePath = path.join(DATA_DIR, kind, `${lang}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing data file: ${filePath}`);
  }
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  cache.set(key, data);
  return data;
}

export function clearCatalogCache() {
  cache.clear();
}
