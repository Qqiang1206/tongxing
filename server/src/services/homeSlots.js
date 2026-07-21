/**
 * Homepage featured slots (fixed capacity).
 * Solutions: homeSlot = '' | 'hero' (1) | 'category' (2)
 * News: homeFeatured = boolean (max 2)
 * Required slots must stay filled — vacating (unpublish / clear) needs a replacement.
 */
import { getDb } from '../db.js';

export const HOME_SLOT_LIMITS = {
  hero: 1,
  category: 2,
  news: 2,
};

export const HOME_SLOT_LABELS = {
  hero: '标杆方案（首页首屏大图）',
  category: '精选方案（三大核心类目）',
  news: '首页精选新闻',
};

function normalizeSolutionSlot(value) {
  if (value === 'hero' || value === 'category') return value;
  return '';
}

function isPublishedFlag(item) {
  if (!item) return false;
  if (Object.prototype.hasOwnProperty.call(item, 'published')) {
    return !!item.published;
  }
  return true;
}

/** Active homepage role of a catalog item (only if published). */
export function homeRoleOf(kind, item) {
  if (!item || !isPublishedFlag(item)) return null;
  if (kind === 'solutions') {
    const slot = normalizeSolutionSlot(item.homeSlot || item.home_slot);
    if (!slot) return null;
    return { slot, kind: 'solutions', label: HOME_SLOT_LABELS[slot], limit: HOME_SLOT_LIMITS[slot] };
  }
  if (kind === 'news') {
    const featured = !!(item.homeFeatured || item.home_featured);
    if (!featured) return null;
    return { slot: 'news', kind: 'news', label: HOME_SLOT_LABELS.news, limit: HOME_SLOT_LIMITS.news };
  }
  return null;
}

export function listSolutionSlotOccupants(slot, excludeId) {
  const db = getDb();
  const s = normalizeSolutionSlot(slot);
  if (!s) return [];
  const rows = db
    .prepare(
      `SELECT s.id, s.home_slot, s.slug, s.image, s.published, i.name
       FROM solutions s
       LEFT JOIN solution_i18n i ON i.solution_id = s.id AND i.lang = 'zh'
       WHERE s.home_slot = ? AND s.published = 1
       ORDER BY s.sort_order, CAST(s.id AS INTEGER)`
    )
    .all(s);
  return rows
    .filter((r) => String(r.id) !== String(excludeId || ''))
    .map((r) => ({
      id: String(r.id),
      name: r.name || r.id,
      slug: r.slug || '',
      image: r.image || '',
      homeSlot: r.home_slot || '',
      published: true,
    }));
}

export function listNewsFeaturedOccupants(excludeId) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT n.id, n.cover, n.published, i.title
       FROM news n
       LEFT JOIN news_i18n i ON i.news_id = n.id AND i.lang = 'zh'
       WHERE n.home_featured = 1 AND n.published = 1
       ORDER BY n.sort_order, CAST(n.id AS INTEGER)`
    )
    .all();
  return rows
    .filter((r) => String(r.id) !== String(excludeId || ''))
    .map((r) => ({
      id: String(r.id),
      title: r.title || r.id,
      cover: r.cover || '',
      homeFeatured: true,
      published: true,
    }));
}

/** Published items that can take a vacated required slot (not already featured elsewhere). */
export function listReplacementCandidates(kind, slot, excludeId) {
  const db = getDb();
  if (kind === 'solutions') {
    const s = normalizeSolutionSlot(slot);
    if (!s) return [];
    const rows = db
      .prepare(
        `SELECT s.id, s.slug, s.image, i.name
         FROM solutions s
         LEFT JOIN solution_i18n i ON i.solution_id = s.id AND i.lang = 'zh'
         WHERE s.published = 1
           AND s.id != ?
           AND (s.home_slot IS NULL OR s.home_slot = '')
         ORDER BY s.sort_order, CAST(s.id AS INTEGER)`
      )
      .all(String(excludeId || ''));
    return rows.map((r) => ({
      id: String(r.id),
      name: r.name || r.id,
      slug: r.slug || '',
      image: r.image || '',
    }));
  }
  if (kind === 'news' && slot === 'news') {
    const rows = db
      .prepare(
        `SELECT n.id, n.cover, i.title
         FROM news n
         LEFT JOIN news_i18n i ON i.news_id = n.id AND i.lang = 'zh'
         WHERE n.published = 1
           AND n.id != ?
           AND (n.home_featured IS NULL OR n.home_featured = 0)
         ORDER BY n.sort_order, CAST(n.id AS INTEGER)`
      )
      .all(String(excludeId || ''));
    return rows.map((r) => ({
      id: String(r.id),
      title: r.title || r.id,
      cover: r.cover || '',
    }));
  }
  return [];
}

export function getHomeSlotsStatus() {
  const hero = listSolutionSlotOccupants('hero');
  const category = listSolutionSlotOccupants('category');
  const news = listNewsFeaturedOccupants();
  return {
    limits: { ...HOME_SLOT_LIMITS },
    labels: { ...HOME_SLOT_LABELS },
    hero: { limit: HOME_SLOT_LIMITS.hero, items: hero },
    category: { limit: HOME_SLOT_LIMITS.category, items: category },
    news: { limit: HOME_SLOT_LIMITS.news, items: news },
  };
}

function clearSolutionSlot(db, id) {
  db.prepare(`UPDATE solutions SET home_slot = '', updated_at = datetime('now') WHERE id = ?`).run(String(id));
}

function clearNewsFeatured(db, id) {
  db.prepare(`UPDATE news SET home_featured = 0, updated_at = datetime('now') WHERE id = ?`).run(String(id));
}

function promoteSolution(db, slot, id) {
  db.prepare(
    `UPDATE solutions SET home_slot = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(slot, String(id));
}

function promoteNews(db, id) {
  db.prepare(
    `UPDATE news SET home_featured = 1, updated_at = datetime('now') WHERE id = ?`
  ).run(String(id));
}

/**
 * If previous item held a required homepage slot and next no longer does,
 * require replaceId and promote that candidate first.
 * Mutates `next` to clear vacated flags.
 */
export function guardRequiredSlotVacate(kind, previous, next, opts = {}) {
  const prevRole = homeRoleOf(kind, previous);
  if (!prevRole) return;

  const nextRole = homeRoleOf(kind, next);
  if (nextRole && nextRole.slot === prevRole.slot) return;

  const replaceId = opts.replaceId != null ? String(opts.replaceId) : '';
  const candidates = listReplacementCandidates(kind, prevRole.slot, previous.id);

  if (!replaceId) {
    const err = new Error('unpublish_needs_replace');
    err.payload = {
      error: 'unpublish_needs_replace',
      message:
        `「${prevRole.label}」是首页必填坑位。下架或取消精选前，请指定另一条已发布内容作为替代` +
        (candidates.length ? '' : '（当前没有可替代的已发布内容，请先发布其他条目）'),
      slot: prevRole.slot,
      kind,
      limit: prevRole.limit,
      candidates,
      action: 'vacate',
    };
    throw err;
  }

  if (!candidates.some((c) => c.id === replaceId)) {
    const err = new Error('unpublish_needs_replace');
    err.payload = {
      error: 'unpublish_needs_replace',
      message: '替代项无效：请选择一条已发布且未占用其他首页坑位的内容',
      slot: prevRole.slot,
      kind,
      limit: prevRole.limit,
      candidates,
      action: 'vacate',
    };
    throw err;
  }

  const db = getDb();
  if (kind === 'solutions') {
    promoteSolution(db, prevRole.slot, replaceId);
    next.homeSlot = normalizeSolutionSlot(next.homeSlot || next.home_slot);
    if (next.homeSlot === prevRole.slot) next.homeSlot = '';
  } else if (kind === 'news') {
    promoteNews(db, replaceId);
    next.homeFeatured = false;
  }
}

/**
 * Enforce slot capacity when claiming a slot (feature onto homepage).
 * @throws {Error} home_slot_full with .payload
 */
export function assertSolutionHomeSlot(item, opts = {}) {
  let slot = normalizeSolutionSlot(item.homeSlot || item.home_slot);
  if (!isPublishedFlag(item)) {
    item.homeSlot = '';
    return;
  }
  item.homeSlot = slot;
  if (!slot) return;

  const occupants = listSolutionSlotOccupants(slot, item.id);
  const limit = HOME_SLOT_LIMITS[slot];
  if (occupants.length < limit) return;

  const replaceId = opts.replaceId != null ? String(opts.replaceId) : '';
  if (replaceId && occupants.some((o) => o.id === replaceId)) {
    clearSolutionSlot(getDb(), replaceId);
    return;
  }

  const err = new Error('home_slot_full');
  err.payload = {
    error: 'home_slot_full',
    message: `${HOME_SLOT_LABELS[slot]}已满（${limit}/${limit}），请选择下架一项后再精选`,
    slot,
    kind: 'solutions',
    limit,
    occupants,
    action: 'claim',
  };
  throw err;
}

export function assertNewsHomeFeatured(item, opts = {}) {
  let featured = !!(item.homeFeatured || item.home_featured);
  if (!isPublishedFlag(item)) {
    item.homeFeatured = false;
    return;
  }
  item.homeFeatured = featured;
  if (!featured) return;

  const occupants = listNewsFeaturedOccupants(item.id);
  const limit = HOME_SLOT_LIMITS.news;
  if (occupants.length < limit) return;

  const replaceId = opts.replaceId != null ? String(opts.replaceId) : '';
  if (replaceId && occupants.some((o) => o.id === replaceId)) {
    clearNewsFeatured(getDb(), replaceId);
    return;
  }

  const err = new Error('home_slot_full');
  err.payload = {
    error: 'home_slot_full',
    message: `${HOME_SLOT_LABELS.news}已满（${limit}/${limit}），请选择下架一项后再精选`,
    slot: 'news',
    kind: 'news',
    limit,
    occupants,
    action: 'claim',
  };
  throw err;
}

/**
 * After bulk import: clear orphan flags on unpublished rows; trim over-capacity
 * (keep earliest by sort_order / id). Does not leave required slots empty intentionally —
 * ops should seed or assign replacements.
 */
export function reconcileHomeSlots() {
  const db = getDb();
  const solCols = db.prepare('PRAGMA table_info(solutions)').all().map((c) => c.name);
  const newsCols = db.prepare('PRAGMA table_info(news)').all().map((c) => c.name);
  if (!solCols.includes('home_slot') || !newsCols.includes('home_featured')) return;

  db.prepare(
    `UPDATE solutions SET home_slot = '', updated_at = datetime('now')
     WHERE published = 0 AND home_slot IS NOT NULL AND home_slot != ''`
  ).run();
  db.prepare(
    `UPDATE news SET home_featured = 0, updated_at = datetime('now')
     WHERE published = 0 AND home_featured = 1`
  ).run();

  for (const slot of ['hero', 'category']) {
    const limit = HOME_SLOT_LIMITS[slot];
    const rows = db
      .prepare(
        `SELECT id FROM solutions
         WHERE home_slot = ? AND published = 1
         ORDER BY sort_order, CAST(id AS INTEGER)`
      )
      .all(slot);
    rows.slice(limit).forEach((r) => clearSolutionSlot(db, r.id));
  }

  const newsRows = db
    .prepare(
      `SELECT id FROM news
       WHERE home_featured = 1 AND published = 1
       ORDER BY sort_order, CAST(id AS INTEGER)`
    )
    .all();
  newsRows.slice(HOME_SLOT_LIMITS.news).forEach((r) => clearNewsFeatured(db, r.id));
}

/** One-time seed matching current homepage picks. */
export function seedHomeSlotsIfEmpty(db) {
  const solCols = db.prepare('PRAGMA table_info(solutions)').all().map((c) => c.name);
  if (!solCols.includes('home_slot')) return;
  const newsCols = db.prepare('PRAGMA table_info(news)').all().map((c) => c.name);
  if (!newsCols.includes('home_featured')) return;

  const solCount =
    db.prepare(
      `SELECT COUNT(*) AS c FROM solutions WHERE home_slot IS NOT NULL AND home_slot != ''`
    ).get()?.c || 0;
  if (solCount === 0) {
    const has = (id) => db.prepare('SELECT id FROM solutions WHERE id = ?').get(String(id));
    if (has('31')) {
      db.prepare(`UPDATE solutions SET home_slot = 'hero' WHERE id = '31'`).run();
    }
    if (has('33')) {
      db.prepare(`UPDATE solutions SET home_slot = 'category' WHERE id = '33'`).run();
    }
    if (has('32')) {
      db.prepare(`UPDATE solutions SET home_slot = 'category' WHERE id = '32'`).run();
    }
  }

  const newsCount =
    db.prepare(`SELECT COUNT(*) AS c FROM news WHERE home_featured = 1`).get()?.c || 0;
  if (newsCount === 0) {
    const has = (id) => db.prepare('SELECT id FROM news WHERE id = ?').get(String(id));
    if (has('1')) db.prepare(`UPDATE news SET home_featured = 1 WHERE id = '1'`).run();
    if (has('2')) db.prepare(`UPDATE news SET home_featured = 1 WHERE id = '2'`).run();
  }
}
