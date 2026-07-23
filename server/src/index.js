import './loadEnv.js';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { URL } from 'url';
import { config, REPO_ROOT } from './config.js';
import { catalog } from './services/catalog.js';
import { handleAdmin } from './admin.js';
import { getDb, dbPathForHealth } from './db.js';
import { recordPageView, shouldTrackPageView, normalizePagePath } from './services/analytics.js';
import { cachedPublic } from './services/publicCache.js';
import { clientIp } from './services/audit.js';
import { createRateLimiter } from './services/rateLimit.js';

// Open SQLite on boot
getDb();

const isProduction = process.env.NODE_ENV === 'production' || process.env.HOST === '127.0.0.1';
const analyticsRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  maxHits: Number(process.env.ANALYTICS_MAX_HITS_PER_MIN || 120),
  label: 'analytics',
});

function publicErrorPayload(err) {
  const payload = { error: 'internal_error' };
  if (!isProduction && err && err.message) payload.message = err.message;
  return payload;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMIN_DIR = path.join(__dirname, '..', 'admin');
const ASSETS_DIR = path.join(REPO_ROOT, 'assets');
const DATA_PUBLIC_DIR = path.join(REPO_ROOT, 'data');

const BLOCKED_SITE_PREFIXES = [
  'server/',
  'node_modules/',
  '.git/',
  '_backups/',
  '_unused-images/',
  'scripts/',
  'data/schema/',
  '.env',
  'package.json',
  'package-lock.json',
  'nginx.conf',
  'web.config',
  'README.md',
  'DESIGN.md',
  'assets/images/uploads/_originals/',
];

function sendJson(res, status, body, origin) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(payload);
}

function parseQuery(url) {
  const q = {};
  for (const [k, v] of url.searchParams) q[k] = v;
  return q;
}

function serveRepoFile(res, rootDir, relPath, origin, cacheControl = 'no-cache') {
  const root = path.resolve(rootDir);
  const filePath = path.resolve(root, relPath);
  if (!filePath.startsWith(root + path.sep) && filePath !== root) {
    return false;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return false;
  }
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.txt': 'text/plain; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
  };
  const data = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': types[ext] || 'application/octet-stream',
    'Access-Control-Allow-Origin': origin,
    'Cache-Control': cacheControl,
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(data);
  return true;
}

function serveAdminStatic(res, pathname, origin) {
  const rel = pathname === '/admin' || pathname === '/admin/'
    ? 'index.html'
    : pathname.replace(/^\/admin\//, '');
  if (rel.includes('..')) {
    sendJson(res, 403, { error: 'forbidden' }, origin);
    return true;
  }
  return serveRepoFile(res, ADMIN_DIR, rel, origin, 'no-store');
}

function serveSiteAsset(res, pathname, origin) {
  if (!pathname.startsWith('/assets/')) return false;
  const rel = pathname.replace(/^\/assets\//, '');
  if (rel.includes('..')) {
    sendJson(res, 403, { error: 'forbidden' }, origin);
    return true;
  }
  const cacheControl = rel.startsWith('fonts/')
    ? 'public, max-age=31536000, immutable'
    : rel.startsWith('images/')
      ? 'public, max-age=2592000'
      : 'public, max-age=604800';
  return serveRepoFile(res, ASSETS_DIR, rel, origin, cacheControl);
}

function serveDataPublic(res, pathname, origin) {
  if (!pathname.startsWith('/data/')) return false;
  const rel = pathname.replace(/^\/data\//, '');
  if (rel.includes('..') || rel.includes('meta/')) {
    sendJson(res, 403, { error: 'forbidden' }, origin);
    return true;
  }
  // Only allow public content bundles (json/js for catalogs, pages, i18n)
  if (!/\.(json|js)$/i.test(rel)) {
    sendJson(res, 403, { error: 'forbidden' }, origin);
    return true;
  }
  return serveRepoFile(res, DATA_PUBLIC_DIR, rel, origin, 'no-cache');
}

function isBlockedSitePath(rel) {
  const norm = rel.replace(/\\/g, '/').replace(/^\//, '');
  return BLOCKED_SITE_PREFIXES.some((p) => norm === p.replace(/\/$/, '') || norm.startsWith(p));
}

/** Serve static corporate site from repo root (HTML, css, etc.). */
function serveSiteStatic(res, pathname, origin) {
  let rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  if (rel.endsWith('/')) rel += 'index.html';
  if (isBlockedSitePath(rel) || rel.includes('..')) {
    sendJson(res, 403, { error: 'forbidden' }, origin);
    return true;
  }
  // Prefer exact file; if missing and no extension, try .html.
  const cacheControl = path.extname(rel).toLowerCase() === '.html'
    ? 'no-cache'
    : 'public, max-age=60';
  if (!serveRepoFile(res, REPO_ROOT, rel, origin, cacheControl)) {
    if (!path.extname(rel) && serveRepoFile(res, REPO_ROOT, `${rel}.html`, origin, 'no-cache')) {
      return true;
    }
    return false;
  }
  return true;
}

const routes = [
  {
    match: (p) => p === '/api/v1/health',
    handler: () => ({
      ok: true,
      service: 'txam-api',
      sourceLang: 'zh',
      storage: 'sqlite',
      db: dbPathForHealth(),
    }),
  },
  {
    match: (p) => p === '/api/v1/home',
    handler: (q) => {
      const lang = catalog.parseLang(q.lang);
      const body = cachedPublic(`home:${lang}`, () => catalog.getHomeBundle(lang));
      if (!body) return { status: 404, body: { error: 'not_found' } };
      return { body };
    },
  },
  {
    match: (p) => p === '/api/v1/products',
    handler: (q) => {
      const lang = catalog.parseLang(q.lang);
      return cachedPublic(`products:${lang}`, () => catalog.getAllProducts(lang));
    },
  },
  {
    match: (p) => /^\/api\/v1\/products\/[^/]+$/.test(p),
    handler: (q, p) => {
      const id = p.split('/').pop();
      const lang = catalog.parseLang(q.lang);
      const item = cachedPublic(`product:${lang}:${id}`, () => catalog.getProductById(id, lang));
      if (!item) return { status: 404, body: { error: 'not_found' } };
      return { body: item };
    },
  },
  {
    match: (p) => p === '/api/v1/solutions',
    handler: (q) => {
      const lang = catalog.parseLang(q.lang);
      return cachedPublic(`solutions:${lang}`, () => catalog.getAllSolutions(lang));
    },
  },
  {
    match: (p) => /^\/api\/v1\/solutions\/by-slug\/[^/]+$/.test(p),
    handler: (q, p) => {
      const slug = p.split('/').pop();
      const lang = catalog.parseLang(q.lang);
      const item = cachedPublic(`solution-slug:${lang}:${slug}`, () => catalog.getSolutionBySlug(slug, lang));
      if (!item) return { status: 404, body: { error: 'not_found' } };
      return { body: item };
    },
  },
  {
    match: (p) => /^\/api\/v1\/solutions\/[^/]+$/.test(p) && !p.includes('/by-slug/'),
    handler: (q, p) => {
      const id = p.split('/').pop();
      const lang = catalog.parseLang(q.lang);
      const item = cachedPublic(`solution:${lang}:${id}`, () => catalog.getSolutionById(id, lang));
      if (!item) return { status: 404, body: { error: 'not_found' } };
      return { body: item };
    },
  },
  {
    match: (p) => p === '/api/v1/site',
    handler: (q) => {
      const lang = catalog.parseLang(q.lang);
      return cachedPublic(`site:${lang}`, () => catalog.loadSiteSettings(lang));
    },
  },
  {
    match: (p) => /^\/api\/v1\/pages\/[^/]+$/.test(p),
    handler: (q, p) => {
      const pageKey = p.split('/').pop();
      const lang = catalog.parseLang(q.lang);
      const item = cachedPublic(`page:${lang}:${pageKey}`, () => catalog.loadPage(pageKey, lang));
      if (!item) return { status: 404, body: { error: 'not_found' } };
      return { body: item };
    },
  },
  {
    match: (p) => p === '/api/v1/news',
    handler: (q) => {
      const lang = catalog.parseLang(q.lang);
      return cachedPublic(`news:${lang}`, () => catalog.getAllNews(lang));
    },
  },
  {
    match: (p) => /^\/api\/v1\/news\/[^/]+$/.test(p),
    handler: (q, p) => {
      const id = p.split('/').pop();
      const lang = catalog.parseLang(q.lang);
      const item = cachedPublic(`news-item:${lang}:${id}`, () => catalog.getNewsById(id, lang));
      if (!item) return { status: 404, body: { error: 'not_found' } };
      return { body: item };
    },
  },
];

const server = http.createServer((req, res) => {
  const origin = config.corsOrigin;
  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {}, origin);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'DELETE') {
    sendJson(res, 405, { error: 'method_not_allowed' }, origin);
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const rawPath = url.pathname || '/';
  const pathname = rawPath.replace(/\/$/, '') || '/';
  const query = parseQuery(url);

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (req.method === 'GET' && serveAdminStatic(res, pathname === '/admin' ? '/admin/' : rawPath, origin)) return;
    sendJson(res, 404, { error: 'not_found' }, origin);
    return;
  }

  if (pathname.startsWith('/assets/') && req.method === 'GET') {
    if (serveSiteAsset(res, pathname, origin)) return;
    sendJson(res, 404, { error: 'not_found' }, origin);
    return;
  }

  if (pathname.startsWith('/data/') && req.method === 'GET') {
    if (serveDataPublic(res, pathname, origin)) return;
    sendJson(res, 404, { error: 'not_found' }, origin);
    return;
  }

  if (pathname.startsWith('/api/v1/admin')) {
    handleAdmin(req, res, pathname, origin, sendJson).then((handled) => {
      if (!handled) sendJson(res, 404, { error: 'not_found' }, origin);
    }).catch((err) => {
      console.error(err);
      sendJson(res, 500, publicErrorPayload(err), origin);
    });
    return;
  }

  if (pathname === '/api/v1/analytics/hit' && (req.method === 'GET' || req.method === 'POST')) {
    try {
      analyticsRateLimit(clientIp(req));
    } catch (err) {
      sendJson(res, err.status || 429, { error: err.message || 'rate_limit_exceeded' }, origin);
      return;
    }
    const hitPath = query.path || rawPath || '/';
    if (shouldTrackPageView(normalizePagePath(hitPath))) {
      recordPageView(hitPath);
    }
    sendJson(res, 204, {}, origin);
    return;
  }

  if (pathname.startsWith('/api/v1')) {
    if (req.method !== 'GET') {
      sendJson(res, 405, { error: 'method_not_allowed' }, origin);
      return;
    }
    for (const route of routes) {
      if (!route.match(pathname)) continue;
      try {
        const result = route.handler(query, pathname);
        if (result && result.status === 404) {
          sendJson(res, 404, result.body, origin);
          return;
        }
        sendJson(res, 200, result.body != null ? result.body : result, origin);
        return;
      } catch (err) {
        console.error(err);
        sendJson(res, 500, publicErrorPayload(err), origin);
        return;
      }
    }
    sendJson(res, 404, { error: 'not_found' }, origin);
    return;
  }

  if (req.method === 'GET') {
    if (serveSiteStatic(res, rawPath, origin)) return;
  }

  sendJson(res, 404, { error: 'not_found' }, origin);
});

server.listen(config.port, config.host, () => {
  console.log(`TXAM site  http://${config.host}:${config.port}/`);
  console.log(`TXAM API   http://${config.host}:${config.port}/api/v1/health`);
  console.log(`TXAM Admin http://${config.host}:${config.port}/admin/`);
  console.log(`Storage: sqlite (${dbPathForHealth()})`);
});
