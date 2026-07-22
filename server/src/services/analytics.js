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
  db.exec(`
    CREATE TABLE IF NOT EXISTS page_view_daily (
      day TEXT NOT NULL,
      path TEXT NOT NULL,
      hits INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (day, path)
    );
  `);
  db.prepare(`
    INSERT INTO page_view_daily (day, path, hits, updated_at)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(day, path) DO UPDATE SET
      hits = hits + 1,
      updated_at = datetime('now')
  `).run(day, pagePath);
  mergeLegacyPageViewPaths(db);
}

function sumHits(db, fromDay, toDay) {
  mergeLegacyPageViewPaths(db);
  const row = db.prepare(`
    SELECT COALESCE(SUM(hits), 0) AS total
    FROM page_view_daily
    WHERE day >= ? AND day <= ?
  `).get(fromDay, toDay);
  return row?.total || 0;
}

function topPaths(db, fromDay, toDay, limit) {
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
    merged.set(canonical, (merged.get(canonical) || 0) + row.hits);
  }

  return [...merged.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([pagePath, hits]) => ({
      path: pagePath,
      label: pathLabel(pagePath),
      hits,
    }));
}

export function getAnalyticsSummary() {
  const db = getDb();
  const today = localDayString();
  const yesterday = localDayString(addDays(new Date(), -1));
  const weekStart = localDayString(addDays(new Date(), -6));

  const todayHits = sumHits(db, today, today);
  const yesterdayHits = sumHits(db, yesterday, yesterday);
  const weekHits = sumHits(db, weekStart, today);

  return {
    today: todayHits,
    yesterday: yesterdayHits,
    week: weekHits,
    topToday: topPaths(db, today, today, 8),
    topWeek: topPaths(db, weekStart, today, 8),
  };
}
