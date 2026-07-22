import path from 'path';
import { getDb } from '../db.js';

const PAGE_LABELS = {
  '/': '首页',
  '/index.html': '首页',
  '/about.html': '关于我们',
  '/products.html': '产品中心',
  '/solutions.html': '解决方案',
  '/news.html': '新闻中心',
  '/contact.html': '联系我们',
};

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
  db.prepare(`
    INSERT INTO page_view_daily (day, path, hits, updated_at)
    VALUES (?, ?, 1, datetime('now'))
    ON CONFLICT(day, path) DO UPDATE SET
      hits = hits + 1,
      updated_at = datetime('now')
  `).run(day, pagePath);
}

function sumHits(db, fromDay, toDay) {
  const row = db.prepare(`
    SELECT COALESCE(SUM(hits), 0) AS total
    FROM page_view_daily
    WHERE day >= ? AND day <= ?
  `).get(fromDay, toDay);
  return row?.total || 0;
}

function topPaths(db, fromDay, toDay, limit) {
  return db.prepare(`
    SELECT path, SUM(hits) AS hits
    FROM page_view_daily
    WHERE day >= ? AND day <= ?
    GROUP BY path
    ORDER BY hits DESC, path ASC
    LIMIT ?
  `).all(fromDay, toDay, limit).map((row) => ({
    path: row.path,
    label: PAGE_LABELS[row.path] || row.path,
    hits: row.hits,
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
