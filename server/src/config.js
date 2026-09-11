import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.join(__dirname, '..');
export const REPO_ROOT = path.join(ROOT, '..');
export const DATA_DIR = path.join(REPO_ROOT, 'data');

/**
 * CORS 允许源。CORS_ORIGIN 支持逗号分隔的多个源，例如：
 *   CORS_ORIGIN=https://www.txam.com,https://txam.com
 * 留空或 "*" 表示放行全部（开发环境默认）。生产环境务必显式列出域名。
 */
function parseAllowedOrigins(raw) {
  const list = String(raw == null ? '*' : raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return list.length ? list : ['*'];
}

export const config = {
  port: Number(process.env.PORT || 8204),
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  allowedOrigins: parseAllowedOrigins(process.env.CORS_ORIGIN),
};

/**
 * 按请求解析实际下发的 Access-Control-Allow-Origin。
 * 配置为 "*" 时原样放行；否则仅回显白名单内的 Origin，
 * 不在白名单的请求回落到第一个允许源（浏览器会因此拒绝跨域读取）。
 */
export function resolveCorsOrigin(req) {
  const allowed = config.allowedOrigins;
  if (allowed.includes('*')) return '*';
  const incoming = req && req.headers ? req.headers.origin : '';
  if (incoming && allowed.includes(incoming)) return incoming;
  return allowed[0];
}

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
