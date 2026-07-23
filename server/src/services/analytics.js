import path from 'path';
import { getDb } from '../db.js';

const PAGE_LABELS = {
  '/': '首页',
  '/about.html': '关于我们',
  '/products.html': '产品中心',
  '/product-detail.html': '产品详情',
  '/solutions.html': '解决方案',
  '/solution-detail.html': '方案详情',
  '/news.html': '新闻中心',
  '/news-detail.html': '新闻详情',
  '/contact.html': '联系我们',
};

const SECTION_LABELS = {
  home: '首页',
  about: '关于我们',
  products: '产品中心',
  solutions: '解决方案',
  news: '新闻中心',
  contact: '联系我们',
  other: '其他页面',
};

function pathLabel(pagePath) {
  const languageMatch = pagePath.match(/^\/(en|ru)(?=\/|$)/);
  const language = languageMatch?.[1];
  const localPath = language ? pagePath.slice(language.length + 1) || '/' : pagePath;
  const pageLabel = PAGE_LABELS[localPath];
  if (!pageLabel) return pagePath;
  if (language === 'en') return '英文站 · ' + pageLabel;
  if (language === 'ru') return '俄文站 · ' + pageLabel;
  return pageLabel;
}

function pathLanguage(pagePath) {
  const languageMatch = String(pagePath || '').match(/^\/(en|ru)(?=\/|$)/);
  return languageMatch?.[1] || 'zh';
}

function pathSection(pagePath) {
  const languageMatch = String(pagePath || '').match(/^\/(en|ru)(?=\/|$)/);
  const localPath = languageMatch ? pagePath.slice(languageMatch[0].length) || '/' : pagePath;
  if (localPath === '/' || localPath === '') return 'home';
  if (localPath.includes('about')) return 'about';
  if (localPath.includes('product')) return 'products';
  if (localPath.includes('solution')) return 'solutions';
  if (localPath.includes('news')) return 'news';
  if (localPath.includes('contact')) return 'contact';
  return 'other';
}

function mergeLegacyPageViewPaths(db) {
  const legacy = db.prepare(`
    SELECT day, path, hits
    FROM page_view_daily
    WHERE path <> ?
      AND (
        path = '/index.html'
        OR path LIKE '%/index.html'
      )
  `).all('/');

  if (!legacy.length) return;

  const bump = db.prepare(`
    INSERT INTO page_view_daily (day, path, hits, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(day, path) DO UPDATE SET
      hits = hits + excluded.hits,
      updated_at = datetime('now')
  `);
  const del = db.prepare('DELETE FROM page_view_daily WHERE day = ? AND path = ?');

  for (const row of legacy) {
    const canonical = normalizePagePath(row.path);
    if (!canonical || canonical === row.path) continue;
    bump.run(row.day, canonical, row.hits);
    del.run(row.day, row.path);
  }
}

function localDayString(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(date, delta) {
  const d = new Date(date);
  d.setDate(d.getDate() + delta);
  return d;
}

function parseDay(value) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(raw + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return null;
  return localDayString(d);
}

function ensureAnalyticsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS page_view_daily (
      day TEXT NOT NULL,
      path TEXT NOT NULL,
      hits INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (day, path)
    );
  `);
}

export function normalizePagePath(pathname) {
  let p = String(pathname || '/').split('?')[0].split('#')[0];
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  if (!p) p = '/';
  if (p === '/index.html') return '/';
  if (p.endsWith('/index.html')) {
    const dir = p.slice(0, -'/index.html'.length) || '/';
    return dir === '/' ? '/' : dir.toLowerCase();
  }
  if (p !== '/' && !path.extname(p)) return p.toLowerCase();
  return p.toLowerCase();
}

export function shouldTrackPageView(pathname) {
  const p = normalizePagePath(pathname);
  if (p.startsWith('/admin') || p.startsWith('/api') || p.startsWith('/assets') || p.startsWith('/data')) {
    return false;
  }
  if (p === '/') return true;
  if (p.endsWith('.html')) return true;
  return !path.extname(p);
}

export function recordPageView(pathname) {
  if (!shouldTrackPageView(pathname)) return;
  const pagePath = normalizePagePath(pathname);
  const day = localDayString();
  const db = getDb();
  ensureAnalyticsTable(db);
  db.prepare(`
    INSERT INTO page_view_daily (day, path, hits, updated_at)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(day, path) DO UPDATE SET
      hits = hits + 1,
      updated_at = datetime('now')
  `).run(day, pagePath);
  mergeLegacyPageViewPaths(db);
}

function sumHits(db, fromDay, toDay, lang) {
  mergeLegacyPageViewPaths(db);
  const rows = db.prepare(`
    SELECT path, SUM(hits) AS hits
    FROM page_view_daily
    WHERE day >= ? AND day <= ?
    GROUP BY path
  `).all(fromDay, toDay);

  let total = 0;
  for (const row of rows) {
    const canonical = normalizePagePath(row.path);
    if (lang && pathLanguage(canonical) !== lang) continue;
    total += Number(row.hits) || 0;
  }
  return total;
}

function topPaths(db, fromDay, toDay, limit, lang) {
  mergeLegacyPageViewPaths(db);
  const rows = db.prepare(`
    SELECT path, SUM(hits) AS hits
    FROM page_view_daily
    WHERE day >= ? AND day <= ?
    GROUP BY path
  `).all(fromDay, toDay);

  const merged = new Map();
  for (const row of rows) {
    const canonical = normalizePagePath(row.path);
    if (lang && pathLanguage(canonical) !== lang) continue;
    merged.set(canonical, (merged.get(canonical) || 0) + Number(row.hits || 0));
  }

  return [...merged.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([pagePath, hits]) => ({
      path: pagePath,
      label: pathLabel(pagePath),
      lang: pathLanguage(pagePath),
      section: pathSection(pagePath),
      hits,
    }));
}

function dailyHits(db, fromDay, toDay, lang) {
  mergeLegacyPageViewPaths(db);
  const rows = db.prepare(`
    SELECT day, path, hits
    FROM page_view_daily
    WHERE day >= ? AND day <= ?
  `).all(fromDay, toDay);

  const byDay = new Map();
  const start = new Date(fromDay + 'T00:00:00');
  const end = new Date(toDay + 'T00:00:00');
  for (let cursor = new Date(start); cursor <= end; cursor = addDays(cursor, 1)) {
    byDay.set(localDayString(cursor), 0);
  }

  for (const row of rows) {
    const canonical = normalizePagePath(row.path);
    if (lang && pathLanguage(canonical) !== lang) continue;
    byDay.set(row.day, (byDay.get(row.day) || 0) + Number(row.hits || 0));
  }

  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, hits]) => ({ day, hits }));
}

function sectionBreakdown(pages) {
  const map = new Map();
  for (const page of pages) {
    const key = page.section || 'other';
    map.set(key, (map.get(key) || 0) + Number(page.hits || 0));
  }
  return [...map.entries()]
    .map(([key, hits]) => ({
      key,
      label: SECTION_LABELS[key] || key,
      hits,
    }))
    .sort((a, b) => b.hits - a.hits);
}

export function getAnalyticsSummary() {
  const db = getDb();
  ensureAnalyticsTable(db);
  const today = localDayString();
  const yesterday = localDayString(addDays(new Date(), -1));
  const weekStart = localDayString(addDays(new Date(), -6));

  return {
    today: sumHits(db, today, today),
    yesterday: sumHits(db, yesterday, yesterday),
    week: sumHits(db, weekStart, today),
    topToday: topPaths(db, today, today, 8),
    topWeek: topPaths(db, weekStart, today, 8),
  };
}

export function getAnalyticsReport(opts = {}) {
  const db = getDb();
  ensureAnalyticsTable(db);

  const today = localDayString();
  let toDay = parseDay(opts.to) || today;
  let fromDay = parseDay(opts.from) || localDayString(addDays(new Date(toDay + 'T00:00:00'), -6));
  if (fromDay > toDay) {
    const swap = fromDay;
    fromDay = toDay;
    toDay = swap;
  }

  const langRaw = String(opts.lang || '').trim().toLowerCase();
  const lang = langRaw === 'zh' || langRaw === 'en' || langRaw === 'ru' ? langRaw : '';

  const page = Math.max(1, Number(opts.page) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(opts.pageSize) || 20));

  const allPages = topPaths(db, fromDay, toDay, 10000, lang || null);
  const total = allPages.reduce((sum, row) => sum + row.hits, 0);
  const dayCount = Math.max(1, dailyHits(db, fromDay, toDay, lang || null).length);
  const totalPages = Math.max(1, Math.ceil(allPages.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const pageRows = allPages.slice(offset, offset + pageSize).map((row) => ({
    ...row,
    share: total ? Math.round((row.hits / total) * 1000) / 10 : 0,
  }));

  const daily = dailyHits(db, fromDay, toDay, lang || null);
  const sections = sectionBreakdown(allPages).map((row) => ({
    ...row,
    share: total ? Math.round((row.hits / total) * 1000) / 10 : 0,
  }));

  return {
    from: fromDay,
    to: toDay,
    lang: lang || 'all',
    total,
    pageCount: allPages.length,
    avgDaily: Math.round((total / dayCount) * 10) / 10,
    daily,
    sections,
    pages: pageRows,
    page: safePage,
    pageSize,
    totalPages,
    totalRows: allPages.length,
  };
}
